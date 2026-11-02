import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDemoConsumptionFixture } from "./helpers/demoConsumptionFixture.mjs";
import { calculateIngredientReorderPoint, getIngredientSalesTotals } from "../src/utils/ingredientReorderUtils.js";

const sql = await readFile(new URL("../supabase/snippets/demo_ingredient_consumption_30_days.sql", import.meta.url), "utf8");
const marker = "[DAYO DEMO ROP V1]";
const snapshot = async (db) => (await db.query(`select
  (select jsonb_agg(i order by id) from ingredients i) ingredients,
  (select jsonb_agg(s order by id) from stock_movements s) movements,
  (select jsonb_agg(o order by id) from orders o) orders,
  (select jsonb_agg(oi order by id) from order_items oi) items`)).rows[0];

test("demo usage proves the app's 300 / 30 * 2 = 20 calculation and preserves stock/history/sync", async () => {
  const db = await createDemoConsumptionFixture();
  try {
    // Revenue-only rows, out-of-window sales, and incomplete sales must not count.
    await db.exec(`
      insert into orders(id,order_number,customer_name,notes,status,payment_status,created_at)
      select 100+n,'DAYO-DEMO-Y1-EXCLUDED-'||n,'Demo Customer',
        case when n=1 then '' else '[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.' end,
        (case when n=4 then 'Pending' else 'Completed' end)::order_status,
        case when n=5 then 'Unpaid' else 'Paid' end,
        now()+case when n=2 then interval '-31 days' when n=3 then interval '1 day' else interval '-1 day' end
      from generate_series(1,5) n;
      insert into order_items(order_id,menu_item_id,item_name,unit_price,quantity)
        select id,100,'Excluded Menu',1,1000 from orders where id>100;
    `);
    const before = await snapshot(db);
    const results = await db.exec(sql);
    const summary = results.flatMap((result) => result.rows).find((row) => row.new_demo_movements !== undefined);
    assert.equal(Number(summary.new_demo_movements), 1);
    const after = await snapshot(db);
    assert.deepEqual(after.ingredients, before.ingredients);
    assert.deepEqual(after.orders, before.orders);
    assert.deepEqual(after.items, before.items);
    assert.deepEqual(after.movements.slice(0, before.movements.length), before.movements);
    const usage = after.movements.find((row) => row.reason.includes(marker));
    assert.equal(Number(usage.adjustment), -300);
    assert.equal(usage.order_id, 100);
    const [original] = (await db.query("select created_at from orders where id=100")).rows;
    assert.equal(new Date(usage.created_at).toISOString(), original.created_at.toISOString());
    const totals = getIngredientSalesTotals(after.movements);
    assert.equal(totals.get("1"), 300);
    assert.equal(calculateIngredientReorderPoint(totals.get("1")).reorderLevel, 20);
    assert.equal(totals.has("2"), false); // No recipe usage is fabricated for this ingredient.
    assert.equal(totals.has("3"), false); // Archived ingredients remain untouched.
    assert.equal(Number((await db.query("select count(*) n from local_sync.outbox")).rows[0].n), 0);
    assert.notEqual((await db.query("select current_setting('app.sync_source',true) v")).rows[0].v, "cloud_mirror");

    const repeated = await db.exec(sql);
    assert.equal(Number(repeated.flatMap((result) => result.rows).find((row) => row.new_demo_movements !== undefined).new_demo_movements), 0);
    assert.deepEqual(await snapshot(db), after);
  } finally { await db.close(); }
});

test("an order with existing completion deductions is not counted a second time", async () => {
  const db = await createDemoConsumptionFixture();
  try {
    await db.exec(`insert into stock_movements(ingredient_id,adjustment,reason,created_at)
      select 1,-300,'Order '||order_number||' completed',created_at from orders where id=100;
      truncate local_sync.outbox;`);
    const before = await snapshot(db);
    await db.exec(sql);
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});

test("recipe drift or a conflicting demo ledger entry aborts without rewriting history", async () => {
  const db = await createDemoConsumptionFixture();
  try {
    await db.exec(sql);
    await db.exec("update menu_item_ingredients set quantity=3 where menu_item_id=100 and ingredient_id=1");
    const before = await snapshot(db);
    await assert.rejects(db.exec(sql), /Existing demo usage differs/);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});

test("missing demo orders or missing recipes produces an actionable error without fake usage", async () => {
  const db = await createDemoConsumptionFixture();
  try {
    await db.exec("delete from menu_item_ingredients");
    const before = await snapshot(db);
    await assert.rejects(db.exec(sql), /no usable ingredient recipes/);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(db), before);
    await db.exec("update orders set created_at=now()-interval '31 days'");
    await assert.rejects(db.exec(sql), /No completed, paid, tagged demo orders/);
    await db.exec("rollback");
  } finally { await db.close(); }
});

test("unexpected trigger stock deductions are detected and rolled back atomically", async () => {
  const db = await createDemoConsumptionFixture();
  try {
    await db.exec(`create function unsafe_stock_side_effect() returns trigger language plpgsql as $$
      begin update ingredients set current_stock=current_stock+new.adjustment
        where id=new.ingredient_id; return new; end $$;
      create trigger unexpected_stock_deduction after insert on stock_movements
        for each row when(new.order_id is not null) execute function unsafe_stock_side_effect();
      update ingredients set current_stock=1000 where id=1; truncate local_sync.outbox;`);
    const before = await snapshot(db);
    await assert.rejects(db.exec(sql), /trigger changed protected ingredient data/);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(db), before);
    assert.equal(Number((await db.query("select count(*) n from local_sync.outbox")).rows[0].n), 0);
  } finally { await db.close(); }
});

test("existing automatic ROP triggers calculate the same value without changing stock or syncing", async () => {
  const db = await createDemoConsumptionFixture({ withReorder: true });
  try {
    const before = (await snapshot(db)).ingredients;
    await db.exec("truncate local_sync.outbox");
    await db.exec(sql);
    const after = (await snapshot(db)).ingredients;
    assert.equal(Number(after[0].reorder_level), 20);
    assert.deepEqual(after.map(({ reorder_level, updated_at, ...row }) => row), before.map(({ reorder_level, updated_at, ...row }) => row));
    assert.equal(Number((await db.query("select count(*) n from local_sync.outbox")).rows[0].n), 0);
  } finally { await db.close(); }
});
