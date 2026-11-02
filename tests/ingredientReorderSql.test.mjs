import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("database ROP backfill, ledger triggers, refresh permissions and mirror replay preserve stock", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create type public.app_role as enum ('ADMIN','SUPER_ADMIN');
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      create function public.has_app_role(roles public.app_role[]) returns boolean language sql stable as $$ select nullif(current_setting('test.app_role',true),'')::public.app_role = any(roles) $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create table public.ingredients(id bigint primary key,name text,current_stock numeric(12,3),reorder_level numeric(12,3) not null default 0,archived_at timestamptz);
      create table public.stock_movements(id bigint generated always as identity primary key,ingredient_id bigint references public.ingredients(id),adjustment numeric(12,3),reason text,created_at timestamptz default clock_timestamp());
      grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
      grant usage,select on all sequences in schema public to authenticated,service_role;
      insert into public.ingredients values(1,'Rice',100,999,null),(2,'Salt',10,999,null),(3,'Archived',9,999,clock_timestamp());
      insert into public.stock_movements(ingredient_id,adjustment,reason,created_at) values
        (1,-300,'Order DY-001 completed',clock_timestamp()-interval '1 day'),
        (1,-700,'Manual stock adjustment',clock_timestamp()-interval '1 day'),
        (1,500,'Order DY-002 completed',clock_timestamp()-interval '1 day'),
        (1,-600,'Expired ingredient stock cleared',clock_timestamp()-interval '1 day'),
        (1,-300,'Order OLD completed',clock_timestamp()-interval '31 days'),
        (1,-300,'Order FUTURE completed',clock_timestamp()+interval '1 day'),
        (3,-999,'Order ARCHIVED completed',clock_timestamp()-interval '1 day');
    `);
    const sql = await readFile(new URL("../supabase/migrations/20261030000001_ingredient_reorder_points.sql", import.meta.url), "utf8");
    await db.exec(sql);
    const levels = async () => (await db.query("select id,reorder_level from public.ingredients order by id")).rows.map((row) => [row.id, Number(row.reorder_level)]);
    await t.test("backfill uses 30 days of completed deductions and does not change stock or archives", async () => {
      assert.deepEqual(await levels(), [[1,20],[2,0],[3,999]]);
      assert.deepEqual((await db.query("select current_stock from public.ingredients order by id")).rows.map((row) => Number(row.current_stock)), [100,10,9]);
    });
    await t.test("stock movement insert, update and delete maintain calculated reorder levels", async () => {
      const added = (await db.query("insert into public.stock_movements(ingredient_id,adjustment,reason) values(1,-30,'Order NEW completed') returning id")).rows[0].id;
      assert.equal((await levels())[0][1], 22);
      await db.query("update public.stock_movements set adjustment=-60 where id=$1", [added]);
      assert.equal((await levels())[0][1], 24);
      await db.query("update public.stock_movements set reason='Inventory record edit' where id=$1", [added]);
      assert.equal((await levels())[0][1], 20);
      await db.query("update public.stock_movements set reason='Order NEW completed' where id=$1", [added]);
      await db.query("delete from public.stock_movements where id=$1", [added]);
      assert.equal((await levels())[0][1], 20);
      await db.exec("insert into public.stock_movements(ingredient_id,adjustment,reason) values(2,-0.001,'Order SMALL completed')");
      assert.equal((await levels())[1][1], 0.001);
    });
    await t.test("history ages out and a refresh restores the current rolling-window result", async () => {
      await db.exec("select public.recalculate_ingredient_reorder_points(clock_timestamp()+interval '62 days')");
      assert.equal((await levels())[0][1], 0);
      await db.exec("select public.recalculate_ingredient_reorder_points(clock_timestamp())");
      assert.equal((await levels())[0][1], 20);
    });
    await t.test("unauthorized and anonymous accounts cannot invoke database recalculation", async () => {
      await db.exec("set role authenticated; set request.jwt.claim.role='authenticated'; set test.app_role=''");
      await assert.rejects(db.exec("select public.refresh_ingredient_reorder_points()"), { code: "42501" });
      await assert.rejects(db.exec("select public.recalculate_ingredient_reorder_points(clock_timestamp())"), { code: "42501" });
      await db.exec("set test.app_role='SUPER_ADMIN'");
      assert.equal(Number((await db.query("select public.refresh_ingredient_reorder_points() as count")).rows[0].count), 0);
      await db.exec("reset role; set role anon");
      await assert.rejects(db.exec("select public.refresh_ingredient_reorder_points()"), { code: "42501" });
      await db.exec("reset role");
    });
    await t.test("cloud replay retains the primary threshold instead of recalculating from partial history", async () => {
      await db.exec("update public.ingredients set reorder_level=555 where id=1; set role service_role; set request.jwt.claim.role='service_role'; set app.sync_source='cloud_mirror'");
      await db.exec("insert into public.stock_movements(ingredient_id,adjustment,reason) values(1,-20,'Order MIRROR completed')");
      assert.equal((await levels())[0][1], 555);
      assert.equal(Number((await db.query("select public.refresh_ingredient_reorder_points() as count")).rows[0].count), 0);
      await db.exec("reset role; set request.jwt.claim.role=''; set app.sync_source=''");
    });
    await t.test("setup can be repeated without changing quantities or ledger history", async () => {
      const stockBefore = (await db.query("select current_stock from public.ingredients order by id")).rows;
      const historyBefore = (await db.query("select count(*) from public.stock_movements")).rows;
      await db.exec(sql);
      assert.deepEqual((await db.query("select current_stock from public.ingredients order by id")).rows, stockBefore);
      assert.deepEqual((await db.query("select count(*) from public.stock_movements")).rows, historyBefore);
      assert.equal((await levels())[0][1], 21.334);
    });
  } finally { await db.close(); }
});
