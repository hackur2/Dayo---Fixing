import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAnalyticsSampleFixture as createFixture } from "./helpers/analyticsSampleFixture.mjs";
import { buildSalesReport, buildItemMovement } from "../src/utils/salesReportUtils.js";
import { buildCustomerActivity, buildRevenueTimeline } from "../src/utils/dashboardUtils.js";

const seed = await readFile(new URL("../supabase/snippets/local_analytics_sample_year.sql", import.meta.url), "utf8");

test("year sample feeds the actual chart calculations without consuming inventory or syncing demo records", async (t) => {
  const db = await createFixture();
  try {
    await db.exec(seed);
    const rows = async (sql) => (await db.query(sql)).rows;
    const [summary] = await rows(`select count(*)::int orders, count(distinct (created_at at time zone 'Asia/Manila')::date)::int days,
      min((created_at at time zone 'Asia/Manila')::date)::text first_day,
      max((created_at at time zone 'Asia/Manila')::date)::text last_day,
      count(distinct to_char(created_at at time zone 'Asia/Manila','YYYY-MM'))::int months,
      count(*) filter(where status <> 'Completed' or payment_status <> 'Paid')::int incomplete,
      count(*) filter(where created_at > clock_timestamp())::int future from orders where order_number like 'DAYO-DEMO-Y1-%'`);
    assert.equal(summary.days, 365);
    assert.equal(summary.first_day, "2025-10-31");
    assert.equal(summary.last_day, "2026-10-30");
    assert.equal(summary.months, 13); // Partial October at each end of 12 months.
    assert.equal(summary.incomplete, 0);
    assert.equal(summary.future, 0);
    assert.ok(summary.orders > 5000);
    assert.equal((await rows("select count(*)::int n from local_sync.outbox"))[0].n, 0);
    assert.equal((await rows("select count(*)::int n from stock_movements where adjustment < 0"))[0].n, 0);
    assert.equal((await rows("select count(*)::int n from order_inventory_deductions"))[0].n, summary.orders);
    assert.notEqual((await rows("select current_setting('app.sync_source',true) value"))[0].value, "cloud_mirror");

    await t.test("production reports have varied revenue, customer activity and both movement classifications", async () => {
      const orders = await rows(`select o.*,coalesce(jsonb_agg(oi.*) filter(where oi.id is not null),'[]') order_items
        from orders o left join order_items oi on oi.order_id=o.id group by o.id`);
      const menu = await rows("select * from menu_items");
      const report = buildSalesReport(orders, menu, await rows("select * from menu_categories"));
      assert.equal(report.dailySales.length, 365);
      assert.ok(new Set(report.dailySales.map((d) => d.totalSales)).size > 100);
      const chart = buildRevenueTimeline(report.dailySales, "2026-10-01", "2026-10-30");
      assert.ok(chart.totalSales > 0 && chart.previousSales > 0);
      assert.equal(chart.data.length, 30);
      const customers = buildCustomerActivity(report.dailySales.map((d) => ({ date: d.date, count: d.totalOrders })), "weekly", "2026-10-30");
      assert.equal(customers.length, 7);
      assert.ok(customers.every((d) => d.count > 0));
      const movement = buildItemMovement(report.movementItems);
      assert.ok(movement.data.some((m) => m.movement === "fast"));
      assert.ok(movement.data.some((m) => m.movement === "slow"));
      assert.ok(movement.items.every((m) => m.quantitySold > 0));
      assert.equal(report.items.length, 9);
      const variantRows = await rows("select distinct menu_item_id,selected_variant_key,unit_price from order_items where menu_item_id in (7,8)");
      assert.deepEqual(variantRows.filter((v) => v.menu_item_id === 7).map((v) => Number(v.unit_price)).sort(), [50,70]);
      assert.deepEqual(variantRows.filter((v) => v.menu_item_id === 8).map((v) => Number(v.unit_price)).sort(), [55,75]);
    });

    await t.test("only eligible zero quantities and missing costs change, with one positive ledger entry per refill", async () => {
      const stock = await rows("select * from ingredients order by id");
      assert.equal(Number(stock[0].current_stock), 20); // 100 recipe portions exceeds 5 kg default.
      assert.equal(Number(stock[0].unit_cost), 120);
      assert.equal(Number(stock[1].current_stock), 10);
      assert.equal(Number(stock[1].unit_cost), 8);
      for (const index of [2,3,4]) {
        assert.equal(Number(stock[index].current_stock), 0);
        assert.equal(stock[index].unit_cost, null);
      }
      assert.equal(Number(stock[5].current_stock), 5000);
      assert.equal(Number(stock[5].unit_cost), 0.06);
      assert.equal(Number(stock[6].current_stock), 40);
      const ledger = await rows("select * from stock_movements order by ingredient_id");
      assert.equal(ledger.length, 2);
      assert.deepEqual(ledger.map((r) => Number(r.adjustment)), [20,5000]);
      assert.equal((await rows("select customer_name from orders where order_number='REAL-KEEP'"))[0].customer_name, "Existing Customer");
    });

    await t.test("repeating the script preserves all existing rows and entered positive costs", async () => {
      await db.exec("update ingredients set unit_cost=17.25 where id=2; truncate local_sync.outbox");
      const snapshot = async () => JSON.stringify(await rows(`select
        (select jsonb_agg(o order by id) from orders o) orders,
        (select jsonb_agg(oi order by id) from order_items oi) items,
        (select jsonb_agg(i order by id) from ingredients i) ingredients,
        (select jsonb_agg(s order by id) from stock_movements s) movements`));
      const before = await snapshot();
      await db.exec(seed);
      assert.equal(await snapshot(), before);
      assert.equal((await rows("select count(*)::int n from local_sync.outbox"))[0].n, 0);
    });
  } finally { await db.close(); }
});

test("a reserved-prefix collision aborts before adding costs or sample sales", async () => {
  const db = await createFixture();
  try {
    await db.exec(`insert into orders(order_number,customer_name,order_type) values('DAYO-DEMO-Y1-20251031-001','Keep','Dine In')`);
    await assert.rejects(db.exec(seed), /Reserved demo order prefix/);
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::int n from orders")).rows[0].n, 2);
    assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_name='ingredients' and column_name='unit_cost'")).rows[0].n, 0);
  } finally { await db.close(); }
});
