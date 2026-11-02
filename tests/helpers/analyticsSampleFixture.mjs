import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const schema = await readFile(new URL("../../supabase/migrations/20261020143115_remote_schema.sql", import.meta.url), "utf8");

export async function createAnalyticsSampleFixture() {
  const db = new PGlite();
  // Load actual column definitions, generated subtotals and completion logic.
  await db.exec(`
    create schema extensions;
    create function extensions.gen_random_bytes(n int) returns bytea language sql
      as $$ select decode(repeat('ab', n), 'hex') $$;
    create type public.order_status as enum ('Pending','Preparing','Ready','Completed','Cancelled');
    create type public.order_type as enum ('Dine In','Take Out');
    create type public.payment_method as enum ('Cash','GCash');
  `);
  for (const table of ["ingredients", "menu_categories", "menu_items", "menu_item_ingredients",
    "menu_item_variants", "menu_variant_sets", "menu_variant_options", "menu_item_variant_sets",
    "orders", "order_items", "order_inventory_deductions", "stock_movements"]) {
    const definition = schema.match(new RegExp(`CREATE TABLE "public"\\."${table}" \\([\\s\\S]*?\\n\\);`));
    assert.ok(definition, `${table} definition is available`);
    await db.exec(definition[0]);
  }
  await db.exec(`
    alter table orders add column status public.order_status not null default 'Pending';
    alter table orders add column order_type public.order_type not null;
    alter table orders add column payment_method public.payment_method;
    alter table orders add constraint orders_gcash_check check(payment_method <> 'GCash' or payment_reference_number is not null);
    alter table order_items add column subtotal numeric(12,2) generated always as (unit_price * quantity) stored;
    alter table order_items add foreign key(order_id) references orders(id);
    alter table order_items add foreign key(menu_item_id) references menu_items(id);
    create schema local_sync;
    create table local_sync.outbox(id bigint generated always as identity, table_name text);
    create function local_sync.capture_change() returns trigger language plpgsql as $$
    begin
      if current_setting('app.sync_source',true) = 'cloud_mirror' then return new; end if;
      insert into local_sync.outbox(table_name) values(tg_table_name); return new;
    end $$;
    insert into menu_categories(id,name) values(1,'Food'),(2,'Drink');
    insert into menu_items(id,name,price,category_id,is_active)
      select n,'Menu ' || n,40+n,case when n <= 6 then 1 else 2 end,true from generate_series(1,9) n;
    insert into menu_item_variants(menu_item_id,variant_key,name,price,sort_order)
      values(7,'small','Small',50,1),(7,'large','Large',70,2);
    insert into menu_variant_sets(id,name) values(1,'Shared drink sizes');
    insert into menu_item_variant_sets values(8,1);
    insert into menu_variant_options values(1,'regular','Regular',55,1),(1,'large','Large',75,2);
    -- A shared variant set overrides legacy per-item variants and base price.
    insert into menu_item_variants(menu_item_id,variant_key,name,price) values(8,'legacy','Legacy',999);
    insert into menu_items(id,name,price,category_id,is_active) values(10,'Archived Menu',100,1,false);
    insert into ingredients(id,name,unit,current_stock,reorder_level,expires_on) values
      (1,'Empty Rice','kg',0,2,null),(2,'Existing Egg','pcs',10,0,null),
      (3,'Expired','pcs',0,0,date '2000-01-01'),(4,'Archived','pcs',0,0,null),
      (5,'Unknown Pack','packs',0,0,null),(6,'Empty Milk','ml',0,0,null),
      (7,'Existing Price','grams',40,0,null);
    insert into menu_item_ingredients values(1,1,0.2),(2,2,1);
    insert into orders(order_number,customer_name,source,payment_status,order_type,payment_method,status,created_at)
      values('REAL-KEEP','Existing Customer','Manual POS','Paid','Dine In','Cash','Completed','2026-10-29T12:00:00+08:00');
    insert into order_items(order_id,menu_item_id,item_name,unit_price,quantity)
      select id,1,'Order-time name',49,2 from orders where order_number='REAL-KEEP';
    alter table ingredients add column archived_at timestamptz;
    update ingredients set archived_at=now() where id=4;
    create trigger demo_orders_capture after insert or update on orders for each row execute function local_sync.capture_change();
    create trigger demo_lines_capture after insert on order_items for each row execute function local_sync.capture_change();
    create trigger demo_ingredients_capture after update on ingredients for each row execute function local_sync.capture_change();
    create trigger demo_stock_capture after insert on stock_movements for each row execute function local_sync.capture_change();
  `);
  const completion = schema.match(/CREATE OR REPLACE FUNCTION public\.deduct_order_ingredients_on_completion\s*\([\s\S]*?\$function\$;/);
  await db.exec(completion[0]);
  await db.exec(`create trigger completion after insert or update of status on orders
    for each row execute function public.deduct_order_ingredients_on_completion()`);
  return db;
}
