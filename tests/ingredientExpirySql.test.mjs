import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("expiry SQL corrects legacy archives to stock-only expiry without losing history", async (t) => {
  const db = new PGlite();
  try {
    const base = await readFile(new URL("../supabase/migrations/20261028000000_ingredient_archive.sql", import.meta.url), "utf8");
    const lifecycle = await readFile(new URL("../supabase/migrations/20261029000000_ingredient_expiry_lifecycle.sql", import.meta.url), "utf8");
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create type public.app_role as enum ('ADMIN','SUPER_ADMIN');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create function public.has_app_role(allowed_roles public.app_role[]) returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.app_role',true),'')::public.app_role = any(allowed_roles),false) $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table public.ingredients(id bigint primary key,name text unique,current_stock numeric not null default 0,reorder_level numeric default 0,unit text default 'kg',expires_on date,updated_at timestamptz default now());
      create table public.menu_items(id bigint primary key,is_available boolean default true);
      create table public.menu_item_ingredients(menu_item_id bigint references public.menu_items(id),ingredient_id bigint references public.ingredients(id) on delete restrict,quantity numeric default 1);
      create table public.stock_movements(id bigint generated always as identity primary key,ingredient_id bigint references public.ingredients(id) on delete restrict,adjustment numeric,reason text,created_by uuid,created_at timestamptz default now());
      create table public.orders(id text primary key,status text,order_number text);
      create table public.order_items(order_id text references public.orders(id),menu_item_id bigint,quantity numeric);
      create table public.order_inventory_deductions(order_id text primary key);
      grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
      grant usage,select on all sequences in schema public to authenticated,service_role;
      alter table public.ingredients enable row level security;
      create policy manage_ingredients on public.ingredients for all to authenticated using(public.has_app_role(array['SUPER_ADMIN']::public.app_role[])) with check(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]));
    `);
    await db.exec(base);
    const todaySql = "(clock_timestamp() at time zone 'Asia/Manila')::date";
    await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on) values
      (1,'Today',10,${todaySql}),(2,'Expired',5,${todaySql}-1),(3,'Soon',20,${todaySql}+3),(4,'Undated',4,null),(5,'Zero',0,${todaySql});
      insert into public.menu_items(id) values(1);
      insert into public.menu_item_ingredients values(1,1,1);
      insert into public.stock_movements(ingredient_id,adjustment,reason) values(2,-1,'Manual stock adjustment');`);
    await db.exec(lifecycle);
    const count = async (table, condition = "true") => Number((await db.query(`select count(*) as count from public.${table} where ${condition}`)).rows[0].count);

    await t.test("the sweep includes today, handles zero stock, and retains recipes and history", async () => {
      assert.deepEqual((await db.query("select public.archive_expired_ingredients() as id")).rows.map((row) => row.id), [1,2,5]);
      assert.equal(await count("ingredients", "archived_at is not null and current_stock=0"), 3);
      assert.equal(await count("ingredient_archives", "archive_reason='expired'"), 3);
      const snapshot = (await db.query("select ingredient_data from public.ingredient_archives where ingredient_id=1")).rows[0].ingredient_data;
      assert.equal(snapshot.current_stock, 10);
      assert.equal(await count("menu_item_ingredients", "ingredient_id=1"), 1);
      assert.equal(await count("stock_movements", "ingredient_id=2 and reason='Manual stock adjustment'"), 1);
      assert.equal(await count("stock_movements", "reason='Expired ingredient archived'"), 2);
      assert.equal((await db.query("select adjustment from public.stock_movements where ingredient_id=1")).rows[0].adjustment, "-10");
    });
    await t.test("repeated sweeps never duplicate archives or stock losses", async () => {
      assert.deepEqual((await db.query("select public.archive_expired_ingredients()")).rows, []);
      assert.equal(await count("ingredient_archives"), 3);
      assert.equal(await count("stock_movements", "reason='Expired ingredient archived'"), 2);
    });
    await t.test("changing an expiry date and inserting expired ingredients archive immediately", async () => {
      await db.exec(`update public.ingredients set expires_on=${todaySql} where id=3;
        insert into public.ingredients(id,name,current_stock,expires_on) values(6,'New expired',6,${todaySql});`);
      assert.equal(await count("ingredients", "id in(3,6) and current_stock=0 and archived_at is not null"), 2);
      assert.equal(await count("ingredient_archives", "ingredient_id in(3,6)"), 2);
      assert.equal(await count("stock_movements", "ingredient_id=6 and adjustment=-6"), 1);
    });
    await t.test("stock cannot be added to an expired archived batch without renewing expiry", async () => {
      await assert.rejects(db.exec("update public.ingredients set current_stock=8 where id=1"), /future expiry/);
      await db.exec(`update public.ingredients set expires_on=${todaySql}+7,current_stock=8 where id=1`);
      assert.equal(await count("ingredients", "id=1 and archived_at is null and current_stock=8"), 1);
      await db.exec(`update public.ingredients set expires_on=${todaySql} where id=1`);
      assert.equal(await count("ingredient_archives", "ingredient_id=1"), 2);
    });
    await t.test("archive or stock-ledger failures roll back the whole expiry operation", async () => {
      await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on) values(7,'Archive failure',11,${todaySql}+1),(8,'Ledger failure',12,${todaySql}+1);
        alter table public.ingredient_archives add constraint fail_archive check(ingredient_id<>7);
        alter table public.stock_movements add constraint fail_ledger check(ingredient_id<>8);`);
      await assert.rejects(db.exec(`update public.ingredients set expires_on=${todaySql} where id=7`), /fail_archive/);
      await assert.rejects(db.exec(`update public.ingredients set expires_on=${todaySql} where id=8`), /fail_ledger/);
      assert.equal(await count("ingredients", "id in(7,8) and archived_at is null and current_stock>0"), 2);
      assert.equal(await count("ingredient_archives", "ingredient_id in(7,8)"), 0);
      await db.exec("alter table public.ingredient_archives drop constraint fail_archive; alter table public.stock_movements drop constraint fail_ledger");
    });
    await t.test("unauthorized staff cannot run the expiry RPC", async () => {
      await db.exec("set test.app_role='ADMIN'; set request.jwt.claim.role='authenticated'; set role authenticated");
      await assert.rejects(db.query("select public.archive_expired_ingredients()"), /authorized Super Admins/);
      await db.exec("reset role; set test.app_role='SUPER_ADMIN'; set role authenticated");
      assert.deepEqual((await db.query("select public.archive_expired_ingredients()")).rows, []);
      await db.exec("reset role; set request.jwt.claim.role=''");
    });
    await t.test("completed orders reject expired stock before the next scheduled sweep", async () => {
      await db.exec(`alter table public.ingredients disable trigger archive_ingredient_before_expiry_write;
        insert into public.ingredients(id,name,current_stock,expires_on) values(9,'Not yet swept',10,${todaySql});
        alter table public.ingredients enable trigger archive_ingredient_before_expiry_write;
        insert into public.menu_items(id) values(9); insert into public.menu_item_ingredients values(9,9,1);
        insert into public.orders values('order-9','Pending','DY-009'); insert into public.order_items values('order-9',9,1);
        create trigger deduct_after_completion after update on public.orders for each row execute function public.deduct_order_ingredients_on_completion();`);
      await assert.rejects(db.exec("update public.orders set status='Completed' where id='order-9'"), /expired stock/);
      assert.equal((await db.query("select status from public.orders where id='order-9'")).rows[0].status, "Pending");
      assert.equal(await count("order_inventory_deductions"), 0);
      await db.query("select public.archive_expired_ingredients()");
    });
    await t.test("cloud-mirrored rows do not create duplicate archives or discarded-stock entries", async () => {
      await db.exec("set request.jwt.claim.role='service_role'; set app.sync_source='cloud_mirror'; set role service_role");
      await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on,archived_at) values(10,'Mirror',0,${todaySql},now())`);
      assert.equal(await count("stock_movements", "ingredient_id=10"), 0);
      assert.equal(await count("ingredient_archives", "ingredient_id=10"), 0);
      await db.exec("reset role; set request.jwt.claim.role=''; set app.sync_source=''");
    });
    const correction = await readFile(new URL("../supabase/snippets/ingredient_expiry_stock_only.sql", import.meta.url), "utf8");
    await t.test("the correction restores automatic expiry archives at zero stock and preserves manual deletions", async () => {
      await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on) values(11,'Manually deleted',4,${todaySql}+7); delete from public.ingredients where id=11;`);
      const historyBefore = await count("stock_movements");
      const archivesBefore = await count("ingredient_archives");
      await db.exec(correction);
      assert.equal(await count("ingredients", "id in(1,2,3,5,6,9) and current_stock=0 and archived_at is null"), 6);
      assert.equal(await count("ingredient_archives"), archivesBefore);
      assert.equal(await count("ingredient_archives", "archive_reason='expired' and restored_at is null"), 0);
      assert.equal(await count("ingredient_archives", "ingredient_id=11 and archive_reason='deleted' and restored_at is null"), 1);
      assert.equal(await count("ingredients", "id=11"), 0);
      assert.equal(await count("stock_movements"), historyBefore);
      assert.equal(await count("menu_item_ingredients", "ingredient_id=1"), 1);
    });
    await t.test("new expiries and expired inserts zero stock but keep catalogue records active", async () => {
      const archivesBefore = await count("ingredient_archives");
      await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on) values(12,'Stock only',10,${todaySql}+3);
        update public.ingredients set expires_on=${todaySql} where id=12;
        insert into public.ingredients(id,name,current_stock,expires_on) values(13,'Expired insert',7,${todaySql});`);
      assert.equal(await count("ingredients", "id in(12,13) and current_stock=0 and archived_at is null"), 2);
      assert.equal(await count("ingredient_archives"), archivesBefore);
      assert.equal(await count("stock_movements", "ingredient_id=12 and adjustment=-10 and reason='Expired ingredient stock cleared'"), 1);
      assert.equal(await count("stock_movements", "ingredient_id=13 and adjustment=-7 and reason='Expired ingredient stock cleared'"), 1);
    });
    await t.test("old cron calls safely clear stock without archiving and repeated checks do not duplicate losses", async () => {
      await db.exec(`alter table public.ingredients disable trigger zero_expired_ingredient_before_write;
        insert into public.ingredients(id,name,current_stock,expires_on) values(14,'Waiting for sweep',9,${todaySql});
        alter table public.ingredients enable trigger zero_expired_ingredient_before_write;`);
      assert.deepEqual((await db.query("select public.archive_expired_ingredients() as id")).rows.map((row) => row.id), [14]);
      assert.equal(await count("ingredients", "id=14 and current_stock=0 and archived_at is null"), 1);
      assert.equal(await count("ingredient_archives", "ingredient_id=14"), 0);
      assert.deepEqual((await db.query("select public.zero_expired_ingredient_stock()")).rows, []);
      assert.equal(await count("stock_movements", "ingredient_id=14 and adjustment=-9"), 1);
    });
    await t.test("stock loss failures roll back zeroing, while expiry never needs an archive write", async () => {
      await db.exec(`insert into public.ingredients(id,name,current_stock,expires_on) values(15,'Loss failure',12,${todaySql}+1);
        alter table public.stock_movements add constraint fail_new_loss check(ingredient_id<>15);`);
      await assert.rejects(db.exec(`update public.ingredients set expires_on=${todaySql} where id=15`), /fail_new_loss/);
      assert.equal(await count("ingredients", "id=15 and current_stock=12 and stock_expired_at is null"), 1);
      await db.exec(`alter table public.stock_movements drop constraint fail_new_loss;
        alter table public.ingredient_archives add constraint no_expiry_archive check(ingredient_id<>16);
        insert into public.ingredients(id,name,current_stock,expires_on) values(16,'No archive write',16,${todaySql});`);
      assert.equal(await count("ingredients", "id=16 and current_stock=0 and archived_at is null"), 1);
      assert.equal(await count("ingredient_archives", "ingredient_id=16"), 0);
      await db.exec("alter table public.ingredient_archives drop constraint no_expiry_archive");
    });
    await t.test("only authorized users can invoke either stock-clearing RPC", async () => {
      await db.exec("set test.app_role='ADMIN'; set request.jwt.claim.role='authenticated'; set role authenticated");
      await assert.rejects(db.query("select public.zero_expired_ingredient_stock()"), /authorized Super Admins/);
      await assert.rejects(db.query("select public.archive_expired_ingredients()"), /authorized Super Admins/);
      await db.exec("reset role; set request.jwt.claim.role=''");
    });
    await t.test("re-running the correction preserves replenished stock and manual Archive records", async () => {
      await db.exec(`update public.ingredients set expires_on=${todaySql}+7,current_stock=8 where id=1`);
      const losses = await count("stock_movements");
      await db.exec(correction);
      assert.equal(await count("ingredients", "id=1 and current_stock=8 and archived_at is null"), 1);
      assert.equal(await count("stock_movements"), losses);
      assert.equal(await count("ingredient_archives", "ingredient_id=11 and restored_at is null"), 1);
    });
    await t.test("restocking an expired ingredient without changing its expiry still leaves zero stock", async () => {
      await db.exec("update public.ingredients set current_stock=5 where id=12");
      assert.equal(await count("ingredients", "id=12 and current_stock=0 and archived_at is null"), 1);
      assert.equal(await count("stock_movements", "ingredient_id=12 and adjustment=-5 and reason='Expired ingredient stock cleared'"), 1);
      assert.equal(await count("ingredient_archives", "ingredient_id=12"), 0);
    });
  } finally { await db.close(); }
});
