import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildInventoryValuation } from "../src/utils/inventoryValuationUtils.js";
import { buildIngredientRevenue } from "../src/utils/salesAnalysisUtils.js";
import { normalizeIngredient } from "../src/adapters/inventoryAdapter.js";

test("unit setup preserves quantity meaning across recipes, order deductions, ROP and financial reports", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create type public.app_role as enum ('ADMIN','SUPER_ADMIN');
      create function auth.role() returns text language sql as $$ select 'authenticated'::text $$;
      create function public.has_app_role(roles public.app_role[]) returns boolean language sql as $$ select true $$;
      create table public.ingredients(id bigint primary key,name text,unit text not null default 'pcs',current_stock numeric(12,3),reorder_level numeric(12,3),unit_cost numeric(14,4),archived_at timestamptz);
      create table public.menu_item_ingredients(menu_item_id bigint,ingredient_id bigint references public.ingredients(id),quantity numeric(12,3));
      create table public.stock_movements(id bigint generated always as identity primary key,ingredient_id bigint references public.ingredients(id),adjustment numeric(12,3),reason text,created_at timestamptz default clock_timestamp());
      create table public.menu_items(id bigint primary key,is_available boolean);
      create table public.orders(id bigint primary key,order_number text,status text);
      create table public.order_items(order_id bigint,menu_item_id bigint,quantity int);
      create table public.order_inventory_deductions(order_id text primary key);
      insert into public.ingredients values
        (1,'Rice','kg',7,99,50,null),(2,'Milk','L',2,99,100,null),
        (3,'Egg','pcs',10,99,5,null),(4,'Salt','grams',100,99,0.1,null),
        (5,'Low cost','kg',1,99,0.0001,null),(6,'Unused','Pcs',0,0,null,null);
      insert into public.menu_items values(1,true);
      insert into public.menu_item_ingredients values(1,1,0.2),(1,2,0.1),(1,3,1);
      insert into public.stock_movements(ingredient_id,adjustment,reason) values
        (1,-3,'Order OLD completed'),(2,-1.5,'Order OLD completed'),(3,-15,'Order OLD completed'),
        (1,10,'Manual stock adjustment'),(1,-1,'Expired ingredient stock cleared');
    `);
    const schema = await readFile(new URL("../supabase/migrations/20261020143115_remote_schema.sql", import.meta.url), "utf8");
    for (const name of ["deduct_order_ingredients_on_completion", "refresh_menu_item_availability"]) {
      const fn = schema.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\([\\s\\S]*?\\$function\\$;`));
      assert.ok(fn, `production ${name} function found`);
      await db.exec(fn[0]);
    }
    await db.exec("create trigger deduct_order after update of status on public.orders for each row execute function public.deduct_order_ingredients_on_completion()");
    const ropSql = await readFile(new URL("../supabase/migrations/20261030000001_ingredient_reorder_points.sql", import.meta.url), "utf8");
    await db.exec(ropSql);
    const unitsSql = await readFile(new URL("../supabase/migrations/20261030000002_ingredient_units.sql", import.meta.url), "utf8");
    const rows = async (table) => (await db.query(`select * from public.${table} order by ${table === "menu_item_ingredients" ? "ingredient_id" : "id"}`)).rows;
    const before = await rows("ingredients");
    const beforeRecipes = await rows("menu_item_ingredients");
    const valuation = buildInventoryValuation(before);
    const revenue = buildIngredientRevenue([{ menuItemId: 1, revenue: 120 }],before,beforeRecipes);
    await db.exec(unitsSql);

    await t.test("kg and L quantities convert with recipe and ledger amounts; aliases only change spelling", async () => {
      const ingredients = await rows("ingredients");
      assert.deepEqual(ingredients.map((r) => [r.unit,Number(r.current_stock)]), [["Grams",7000],["mL",2000],["Pcs",10],["Grams",100],["Grams",1000],["Pcs",0]]);
      assert.deepEqual((await rows("menu_item_ingredients")).map((r) => Number(r.quantity)), [200,100,1]);
      assert.deepEqual((await rows("stock_movements")).map((r) => Number(r.adjustment)), [-3000,-1500,-15,10000,-1000]);
      assert.equal(Number(ingredients[0].reorder_level),200);
      assert.equal(Number(ingredients[1].reorder_level),100);
      assert.equal(Number(ingredients[4].unit_cost),0.0000001);
      assert.deepEqual(buildInventoryValuation(ingredients),valuation);
      assert.deepEqual(buildIngredientRevenue([{ menuItemId: 1,revenue: 120 }],ingredients,await rows("menu_item_ingredients")),revenue);
    });

    await t.test("menu availability used by AI and completed orders still use the same physical amounts", async () => {
      await db.exec("select public.refresh_menu_item_availability(1)");
      assert.equal((await db.query("select is_available from public.menu_items where id=1")).rows[0].is_available,true);
      await db.exec("insert into public.orders values(1,'DY-NEW','Pending'); insert into public.order_items values(1,1,2); update public.orders set status='Completed' where id=1");
      const ingredients = await rows("ingredients");
      assert.deepEqual(ingredients.slice(0,3).map((r) => Number(r.current_stock)),[6600,1800,8]);
      assert.equal(Number(ingredients[0].reorder_level),226.667);
      assert.equal(normalizeIngredient(ingredients[0]).unit,"Grams");
      await db.exec("update public.orders set status='Completed' where id=1");
      assert.equal(Number((await rows("ingredients"))[0].current_stock),6600);
    });

    await t.test("custom and empty units are rejected and existing quantities cannot be reinterpreted", async () => {
      for (const unit of ["", "kg", "grams", "packs"]) {
        await assert.rejects(db.query("insert into public.ingredients(id,name,unit,current_stock,reorder_level) values(100,'Bad',$1,0,0)",[unit]),{code:"23514"});
      }
      await assert.rejects(db.exec("update public.ingredients set unit='mL' where id=1"),{code:"23514"});
      await db.exec("update public.ingredients set unit='mL' where id=6");
      assert.equal((await rows("ingredients"))[5].unit,"mL");
    });

    await t.test("repeating setup preserves converted stock, history, recipes and expanded cost precision", async () => {
      const stock = await rows("ingredients"), recipes = await rows("menu_item_ingredients"), history = await rows("stock_movements");
      await db.exec(unitsSql);
      assert.deepEqual(await rows("ingredients"),stock);
      assert.deepEqual(await rows("menu_item_ingredients"),recipes);
      assert.deepEqual(await rows("stock_movements"),history);
      assert.equal((await db.query("select tgenabled from pg_trigger where tgname='refresh_reorder_point_from_stock_movement'")).rows[0].tgenabled,"O");
    });
  } finally { await db.close(); }
});

test("unknown legacy pack sizes abort setup before any stock or history changes", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table ingredients(id bigint,unit text,current_stock numeric); create table menu_item_ingredients(ingredient_id bigint,quantity numeric); create table stock_movements(ingredient_id bigint,adjustment numeric); insert into ingredients values(1,'kg',2),(2,'packs',3)");
    const sql = await readFile(new URL("../supabase/migrations/20261030000002_ingredient_units.sql", import.meta.url),"utf8");
    await assert.rejects(db.exec(sql),/explicit quantity conversion.*2: packs/);
    await db.exec("rollback");
    assert.deepEqual((await db.query("select * from ingredients order by id")).rows,[{id:1,unit:"kg",current_stock:"2"},{id:2,unit:"packs",current_stock:"3"}]);
  } finally { await db.close(); }
});

test("the configured seed data loads under the three-unit constraint with consistent Rice quantities", async (t) => {
  // The local dump includes private account data and intentionally stays ignored.
  const seed = await readFile(new URL("../supabase/seed.sql",import.meta.url),"utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    t.skip("No private local seed dump in this checkout.");
    return null;
  });
  if (seed === null) return;
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.ingredients(id bigint,name text,category text,current_stock numeric,reorder_level numeric,unit text not null check(unit in ('Pcs','Grams','mL')),expires_on date,updated_at timestamptz,created_at timestamptz);
      create table public.menu_item_ingredients(menu_item_id bigint,ingredient_id bigint,quantity numeric);
      create table public.stock_movements(id bigint,ingredient_id bigint,adjustment numeric,reason text,order_id bigint,created_by uuid,created_at timestamptz);
    `);
    for (const table of ["ingredients","menu_item_ingredients","stock_movements"]) {
      const insert = seed.match(new RegExp(`INSERT INTO "public"\\."${table}"[\\s\\S]*?;`));
      assert.ok(insert);
      await db.exec(insert[0]);
    }
    assert.deepEqual((await db.query("select unit,current_stock,reorder_level from ingredients where id=9")).rows[0],{unit:"Grams",current_stock:"7000.000",reorder_level:"5000.000"});
    assert.equal((await db.query("select count(*) from menu_item_ingredients where ingredient_id=9 and quantity=250")).rows[0].count,9);
    assert.equal((await db.query("select count(*) from stock_movements where ingredient_id=9")).rows[0].count,14);
    assert.equal(Number((await db.query("select adjustment from stock_movements where id=147")).rows[0].adjustment),-250);
  } finally { await db.close(); }
});
