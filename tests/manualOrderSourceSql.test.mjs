import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const readMigration = (name) => readFile(new URL(name, migrations), "utf8");

test("manual order source migration preserves history and keeps the existing write paths compatible", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema storage; create table storage.objects(bucket_id text);
      create schema extensions;
      create function extensions.gen_random_bytes(n int) returns bytea language sql
        as $$ select decode(repeat('ab', n), 'hex') $$;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb, email text);
      create function auth.uid() returns uuid language sql
        as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
    `);
    for (const name of [
      "20261020143115_remote_schema.sql",
      "20261020150000_local_cloud_sync.sql",
      "20261030000003_safe_cloud_sync.sql",
      "20261030000005_sync_receiver_performance.sql",
      "20261031000000_sync_conflict_http_errors.sql",
    ]) await db.exec(await readMigration(name));
    await db.exec(await readFile(new URL("../supabase/snippets/cloud_sync_local_setup.sql", import.meta.url), "utf8"));
    await db.exec(`
      insert into public.orders(id,order_number,customer_name,order_type,source,updated_at)
        values (1,'TEST-MANUAL','Walk-in','Dine In','Manual POS','2026-10-01T00:00:00Z');
      insert into public.orders(id,order_number,customer_name,order_type)
        values (2,'TEST-QR','Test Customer','Dine In');
      insert into cloud_sync.records(table_name,row_key,source_id,source_version,row_data)
        select 'orders','{"id":1}',source_id,5,to_jsonb(o)-'created_by'
        from public.orders o cross join local_sync.settings where o.id=1;
      insert into local_sync.batches(event_ids,payload)
        select array[id], jsonb_build_array(jsonb_build_object('table_name',table_name,'row_data',row_data))
        from local_sync.outbox where row_key='{"id":1}';
    `);
    const rename = await readMigration("20261106000000_manual_order_taker_source.sql");
    await assert.rejects(db.exec(rename), /Resolve queued Manual POS orders/);
    await db.exec("rollback; update local_sync.outbox set sync_status = 'synced';");
    await assert.rejects(db.exec(rename), /Resolve queued Manual POS orders/);
    await db.exec("rollback; update local_sync.batches set confirmed_at = now();");
    const archivedBatch = (await db.query("select payload::text from local_sync.batches")).rows[0].payload;

    await db.exec(rename);
    const historical = (await db.query("select source,updated_at='2026-10-01T00:00:00Z' as unchanged from public.orders where id=1")).rows[0];
    assert.deepEqual(historical, { source: "Manual Order Taker", unchanged: true });
    assert.equal((await db.query("select source from public.orders where id=2")).rows[0].source, "QR Order");
    assert.equal((await db.query("select count(*)::int as n from local_sync.outbox")).rows[0].n, 2);
    assert.equal((await db.query("select payload::text from local_sync.batches")).rows[0].payload, archivedBatch);
    assert.deepEqual((await db.query("select row_data->>'source' as source,source_version::int as version from cloud_sync.records")).rows[0],
      { source: "Manual Order Taker", version: 5 });

    await db.exec(`
      insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');
      update public.profiles set is_authorized=true;
      set test.user_id = '00000000-0000-0000-0000-000000000001';
      insert into public.ingredients(id,name,current_stock) values (1,'Test Ingredient',10);
      insert into public.menu_items(id,name,price,is_active,is_available) values(1,'Test Meal',100,true,true);
      insert into public.menu_item_ingredients(menu_item_id,ingredient_id,quantity) values (1,1,1);
      select public.create_manual_order('New staff order','Dine In','Cash',null,null,'[{"menuItemId":1,"quantity":1}]');
    `);
    assert.equal((await db.query("select source from public.orders where customer_name='New staff order'")).rows[0].source, "Manual Order Taker");
    assert.equal((await db.query("select row_data->>'source' as source from local_sync.outbox where row_data->>'customer_name'='New staff order'")).rows[0].source, "Manual Order Taker");
    await db.query(`select public.apply_cloud_sync_batch(source_id, gen_random_uuid(), jsonb_build_array(jsonb_build_object(
      'table_name','orders','row_key','{"id":1}'::jsonb,'operation','UPDATE','version','6',
      'row_data',to_jsonb(o)||'{"notes":"After cutover"}'::jsonb
    ))::text) from local_sync.settings cross join public.orders o where o.id=1`);
    assert.equal((await db.query("select notes from public.orders where id=1")).rows[0].notes, "After cutover");
  } finally {
    await db.close();
  }
});
