import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20261030000004_suppliers.sql", import.meta.url), "utf8");

test("supplier setup supports the app, enforces staff roles, and preserves rows on repeat runs", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create type public.app_role as enum ('ADMIN','SUPER_ADMIN');
      create function public.has_app_role(allowed public.app_role[]) returns boolean
        language sql stable as $$ select coalesce(current_setting('test.app_role',true) = any(allowed::text[]),false) $$;
      create function public.set_updated_at() returns trigger language plpgsql as $$
        begin new.updated_at := now(); return new; end $$;
      grant usage on schema public to anon, authenticated, service_role;
      create schema local_sync;
      create table local_sync.outbox(id bigint generated always as identity,table_name text);
      create function local_sync.capture_change() returns trigger language plpgsql as $$
        begin insert into local_sync.outbox(table_name) values(tg_table_name); return new; end $$;
    `);
    await db.exec(migration);

    await t.test("authorized Super Admin can create, read, update and delete using the app's fields", async () => {
      await db.exec("set test.app_role='SUPER_ADMIN'; set role authenticated");
      const supplier = (await db.query(`insert into suppliers(name,product_type,product_name,mobile,address)
        values('Test Trading','Rice','Rice','09170000000','Test address')
        returning id,name,product_type,mobile,address`)).rows[0];
      assert.equal(supplier.id, 1);
      assert.equal(supplier.product_type, "Rice");
      await db.exec("update suppliers set mobile='09170000001' where id=1");
      assert.equal((await db.query("select mobile from suppliers where id=1")).rows[0].mobile, "09170000001");
      await db.exec("delete from suppliers where id=1");
      assert.deepEqual((await db.query("select * from suppliers")).rows, []);
      await db.exec("reset role; insert into suppliers(name,product_type) values('Keep Supplier','Egg')");
    });

    await t.test("anonymous and ordinary staff cannot access supplier records", async () => {
      await db.exec("set role anon");
      await assert.rejects(db.query("select * from suppliers"), /permission denied/);
      await db.exec("reset role; set test.app_role='ADMIN'; set role authenticated");
      assert.deepEqual((await db.query("select * from suppliers")).rows, []);
      await assert.rejects(db.query("insert into suppliers(name,product_type) values('Denied','Rice')"), /row-level security/);
      assert.deepEqual((await db.query("delete from suppliers returning id")).rows, []);
      await db.exec("reset role");
    });

    await t.test("repeat setup keeps existing records and does not enable incompatible legacy sync capture", async () => {
      const before = (await db.query("select * from suppliers")).rows;
      await db.exec(migration);
      assert.deepEqual((await db.query("select * from suppliers")).rows, before);
      assert.equal((await db.query("select count(*)::int n from local_sync.outbox")).rows[0].n, 0);
      assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='suppliers'::regclass and tgname='local_sync_capture_change'")).rows[0].n, 0);
    });

    await t.test("upgraded sync capture is attached only when the compatible helpers exist", async () => {
      await db.exec(`
        create schema cloud_sync;
        create function cloud_sync.allowed_table(name text) returns boolean language sql as $$ select name='suppliers' $$;
        create function local_sync.queue_record(name text, operation text, row_data jsonb, transaction_id bigint)
          returns bigint language sql as $$ select 1::bigint $$;
      `);
      await db.exec(migration);
      await db.exec("insert into suppliers(name,product_type) values('Synced Supplier','Milk')");
      assert.equal((await db.query("select count(*)::int n from local_sync.outbox where table_name='suppliers'")).rows[0].n, 1);
    });
  } finally { await db.close(); }
});
