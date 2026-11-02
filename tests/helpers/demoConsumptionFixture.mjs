import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const base = new URL("../../supabase/migrations/", import.meta.url);
const schema = await readFile(new URL("20261020143115_remote_schema.sql", base), "utf8");
const expiry = await readFile(new URL("20261029000001_expiry_stock_only.sql", base), "utf8");
const tables = ["ingredients", "menu_item_ingredients", "orders", "order_items", "stock_movements"];

export async function createDemoConsumptionFixture({ seed = true, withReorder = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions;
    create function extensions.gen_random_bytes(n int) returns bytea language sql
      as $$ select decode(repeat('ab',n),'hex') $$;
    create schema auth;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create type public.app_role as enum ('ADMIN','SUPER_ADMIN');
    create function public.has_app_role(roles public.app_role[]) returns boolean language sql as $$ select false $$;
    create type public.order_status as enum ('Pending','Preparing','Ready','Completed','Cancelled');
    create type public.order_type as enum ('Dine In','Take Out');
    create type public.payment_method as enum ('Cash','GCash');
  `);
  for (const table of tables) {
    const definition = schema.match(new RegExp(`CREATE TABLE "public"\\."${table}" \\([\\s\\S]*?\\n\\);`));
    assert.ok(definition, `${table}: actual column definitions`);
    await db.exec(definition[0]);
  }
  await db.exec(`
    alter table ingredients add column archived_at timestamptz;
    alter table ingredients add column unit_cost numeric(18,7);
    alter table ingredients add column expiry_discarded_stock numeric not null default 0;
    alter table ingredients add column stock_expired_at timestamptz;
    alter table orders add column status public.order_status not null default 'Pending';
    alter table orders add column order_type public.order_type not null default 'Dine In';
    alter table orders add column payment_method public.payment_method;
    alter table order_items add column subtotal numeric(12,2) generated always as (unit_price*quantity) stored;
    alter table order_items add foreign key(order_id) references orders(id);
    alter table stock_movements add foreign key(order_id) references orders(id);
    alter table stock_movements add foreign key(ingredient_id) references ingredients(id);
    create schema local_sync;
    create table local_sync.outbox(id bigint generated always as identity,table_name text);
    create function local_sync.capture_change() returns trigger language plpgsql as $$
    begin
      if current_setting('app.sync_source',true) = 'cloud_mirror' then return new; end if;
      insert into local_sync.outbox(table_name) values(tg_table_name); return new;
    end $$;
    create trigger local_sync_capture_change after insert or update or delete on stock_movements
      for each row execute function local_sync.capture_change();
    create trigger local_sync_capture_change after insert or update or delete on ingredients
      for each row execute function local_sync.capture_change();
  `);
  for (const name of ["zero_expired_ingredient_before_write", "record_expired_ingredient_loss"]) {
    const fn = expiry.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`));
    assert.ok(fn, `${name}: actual expiry function`);
    await db.exec(fn[0]);
  }
  // Match production's existing expiry behavior; importing history must not invoke it.
  await db.exec(`
    create trigger zero_expired_ingredient_before_write before insert or update on ingredients
      for each row execute function public.zero_expired_ingredient_before_write();
    create trigger record_expired_ingredient_loss after insert or update on ingredients
      for each row execute function public.record_expired_ingredient_loss();
  `);
  if (seed) {
    await db.exec(`
      insert into ingredients(id,name,unit,current_stock,unit_cost,expires_on) values
        (1,'Demo Egg','Pcs',100,8,current_date+interval '1 year'),
        (2,'Unlinked Flour','Grams',500,.12,null),
        (3,'Archived Ingredient','Pcs',10,2,null);
      update ingredients set archived_at=now() where id=3;
      insert into menu_item_ingredients values(100,1,2),(101,1,1),(100,3,4);
      insert into orders(id,order_number,customer_name,notes,status,payment_status,created_at)
        values(100,'DAYO-DEMO-Y1-TEST-001','Demo Customer',
          '[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.',
          'Completed','Paid',clock_timestamp()-interval '2 days');
      insert into order_items(order_id,menu_item_id,item_name,unit_price,quantity)
        values(100,100,'Demo Menu A',50,100),(100,101,'Demo Menu B',20,100);
      insert into stock_movements(ingredient_id,adjustment,reason,created_at) values
        (1,-900,'Manual stock adjustment',now()),(1,-50,'Expired ingredient stock cleared',now()),
        (1,-7000,'Order OLD completed',now()-interval '31 days'),
        (1,-3000,'Order FUTURE completed',now()+interval '1 day');
      truncate local_sync.outbox;
    `);
  }
  if (withReorder) {
    await db.exec(await readFile(new URL("20261030000001_ingredient_reorder_points.sql", base), "utf8"));
  }
  return db;
}

export async function loadDemoConsumptionSnapshot(db, snapshot) {
  // Restore the snapshot exactly before enabling the production write behavior.
  await db.exec("alter table ingredients disable trigger zero_expired_ingredient_before_write; alter table ingredients disable trigger record_expired_ingredient_loss;");
  for (const [table, key] of [["ingredients", "ingredients"], ["menu_item_ingredients", "recipes"],
    ["orders", "orders"], ["order_items", "order_items"], ["stock_movements", "stock_movements"]]) {
    if (!snapshot[key].length) continue;
    const columns = (await db.query(`select attname from pg_attribute
      where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum`, [table]))
      .rows.filter((row) => Object.hasOwn(snapshot[key][0], row.attname)).map((row) => `"${row.attname}"`).join(",");
    try {
      await db.query(`insert into ${table} (${columns}) overriding system value
        select ${columns} from jsonb_populate_recordset(null::${table},$1::jsonb)`, [JSON.stringify(snapshot[key])]);
    } catch (error) {
      throw new Error(`Test snapshot load (${table}): ${error.message}`);
    }
  }
  await db.exec(`select setval(pg_get_serial_sequence('stock_movements','id'),
    greatest(coalesce((select max(id) from stock_movements),0)+1,1),false);
    alter table ingredients enable trigger zero_expired_ingredient_before_write;
    alter table ingredients enable trigger record_expired_ingredient_loss;
    truncate local_sync.outbox;`);
}
