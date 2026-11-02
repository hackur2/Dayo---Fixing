import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const setup = await readFile(new URL("../supabase/snippets/ingredient_archive_setup.sql", import.meta.url), "utf8");
const localSync = await readFile(new URL("../supabase/local_sync.sql", import.meta.url), "utf8");

test("Archive SQL Editor setup preserves ingredient deletions transactionally", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create type public.app_role as enum ('ADMIN', 'SUPER_ADMIN');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create function public.has_app_role(allowed_roles public.app_role[]) returns boolean language sql stable as $$ select coalesce(nullif(current_setting('test.app_role', true), '')::public.app_role = any(allowed_roles), false) $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table public.ingredients (
        id bigint primary key, name text not null, category text default 'Food Ingredient', current_stock numeric default 0,
        reorder_level numeric default 0, unit text default 'kg', expires_on date, updated_at timestamptz default now(), created_at timestamptz default now()
      );
      create table public.menu_item_ingredients (ingredient_id bigint references public.ingredients(id) on delete restrict);
      create table public.stock_movements (ingredient_id bigint references public.ingredients(id) on delete restrict);
      grant select, insert, update, delete on public.ingredients, public.menu_item_ingredients, public.stock_movements to authenticated;
      alter table public.ingredients enable row level security;
      create policy "Super admins manage ingredients" on public.ingredients for all to authenticated using (public.has_app_role(array['SUPER_ADMIN']::public.app_role[])) with check (public.has_app_role(array['SUPER_ADMIN']::public.app_role[]));
    `);
    await db.exec(localSync.split(/\r?\ndo \$\$/)[0]);
    await db.exec(setup);
    await db.exec("create trigger local_sync_capture_change after insert or update or delete on public.ingredients for each row execute function local_sync.capture_change()");

    async function superAdmin() {
      await db.exec("reset role; set test.app_role = 'SUPER_ADMIN'; set request.jwt.claim.role = 'authenticated'; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; set role authenticated");
    }

    await t.test("successful deletion saves the complete snapshot and actor in the same transaction", async () => {
      await db.exec("insert into public.ingredients (id,name,current_stock,reorder_level,expires_on) values (41,'Rice',12.5,3,'2026-11-01')");
      await superAdmin();
      assert.equal((await db.query("select public.delete_ingredient_to_archive(41) as id")).rows[0].id, 41);
      assert.equal((await db.query("select * from public.ingredients where id=41")).rows.length, 0);
      const archive = (await db.query("select * from public.ingredient_archives where ingredient_id=41")).rows[0];
      assert.equal(archive.ingredient_data.name, "Rice");
      assert.equal(archive.ingredient_data.current_stock, 12.5);
      assert.equal(archive.ingredient_data.reorder_level, 3);
      assert.equal(archive.ingredient_data.expires_on, "2026-11-01");
      assert.equal(archive.archived_by, "11111111-1111-4111-8111-111111111111");
      assert.ok(archive.archived_at);
      await db.exec("reset role");
      const events = (await db.query("select table_name, operation from local_sync.outbox order by id")).rows;
      assert.deepEqual(events.slice(-2), [{ table_name: "ingredient_archives", operation: "INSERT" }, { table_name: "ingredients", operation: "DELETE" }]);
    });

    await t.test("recipe and stock history protections leave the ingredient and archive unchanged", async () => {
      await db.exec("insert into public.ingredients (id,name) values (42,'Chicken'),(43,'Milk'); insert into public.menu_item_ingredients values(42); insert into public.stock_movements values(43)");
      await superAdmin();
      await assert.rejects(db.query("select public.delete_ingredient_to_archive(42)"), /menu recipe/);
      await assert.rejects(db.query("select public.delete_ingredient_to_archive(43)"), /stock movement history/);
      assert.equal((await db.query("select * from public.ingredients where id in(42,43)")).rows.length, 2);
      assert.equal((await db.query("select * from public.ingredient_archives where ingredient_id in(42,43)")).rows.length, 0);
      await db.exec("reset role");
    });

    await t.test("an archive write failure rolls back ingredient deletion", async () => {
      await db.exec("insert into public.ingredients(id,name) values(44,'Garlic'); alter table public.ingredient_archives add constraint test_archive_failure check(ingredient_id<>44)");
      await superAdmin();
      await assert.rejects(db.query("select public.delete_ingredient_to_archive(44)"), /test_archive_failure/);
      assert.equal((await db.query("select * from public.ingredients where id=44")).rows.length, 1);
      assert.equal((await db.query("select * from public.ingredient_archives where ingredient_id=44")).rows.length, 0);
      await db.exec("reset role; alter table public.ingredient_archives drop constraint test_archive_failure");
    });

    await t.test("unauthorized staff cannot delete ingredients, read archives, or edit snapshots", async () => {
      await db.exec("insert into public.ingredients(id,name) values(45,'Salt'); set test.app_role='ADMIN'; set role authenticated");
      await assert.rejects(db.query("select public.delete_ingredient_to_archive(45)"), /Only authorized Super Admins/);
      assert.deepEqual((await db.query("select * from public.ingredient_archives")).rows, []);
      await assert.rejects(db.query("insert into public.ingredient_archives(ingredient_id,ingredient_data) values(45,'{}')"), /permission denied/);
      await db.exec("reset role");
      assert.equal((await db.query("select * from public.ingredients where id=45")).rows.length, 1);
    });

    await t.test("SQL Editor setup can be rerun without losing archive records", async () => {
      const before = (await db.query("select id from public.ingredient_archives order by id")).rows;
      await db.exec(setup);
      assert.deepEqual((await db.query("select id from public.ingredient_archives order by id")).rows, before);
    });

    await t.test("cloud mirror preserves the supplied archive exactly once and clears local user IDs", async () => {
      await db.exec("insert into public.ingredients(id,name) values(46,'Tea'); delete from local_sync.outbox; set request.jwt.claim.role='service_role'; set role service_role");
      const snapshot = { id: "22222222-2222-4222-8222-222222222222", ingredient_id: 46, ingredient_data: { id: 46, name: "Tea" }, archived_at: "2026-10-28T04:00:00Z", archived_by: "11111111-1111-4111-8111-111111111111" };
      await db.query("select public.apply_local_sync_event('ingredient_archives','INSERT',$1::jsonb)", [JSON.stringify(snapshot)]);
      await db.query("select public.apply_local_sync_event('ingredients','DELETE',$1::jsonb)", [JSON.stringify({ id: 46 })]);
      await db.exec("reset role");
      const archives = (await db.query("select * from public.ingredient_archives where ingredient_id=46")).rows;
      assert.equal(archives.length, 1);
      assert.equal(archives[0].id, snapshot.id);
      assert.equal(archives[0].archived_by, null);
      assert.equal((await db.query("select * from public.ingredients where id=46")).rows.length, 0);
      assert.equal((await db.query("select * from local_sync.outbox")).rows.length, 0);
    });
  } finally {
    await db.close();
  }
});
