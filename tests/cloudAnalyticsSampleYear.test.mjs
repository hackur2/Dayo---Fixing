import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAnalyticsSampleFixture } from "./helpers/analyticsSampleFixture.mjs";
import { buildSalesReport, buildItemMovement } from "../src/utils/salesReportUtils.js";
import { buildCustomerActivity, buildRevenueTimeline } from "../src/utils/dashboardUtils.js";

const seed = await readFile(new URL("../supabase/snippets/cloud_analytics_sample_year.sql", import.meta.url), "utf8");
const expiryMigration = await readFile(new URL("../supabase/migrations/20261029000001_expiry_stock_only.sql", import.meta.url), "utf8");

async function cloudFixture() {
  const db = await createAnalyticsSampleFixture();
  await db.exec(`
    drop schema local_sync cascade;
    create schema auth;
    create function auth.role() returns text language sql as $$ select null::text $$;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    alter table ingredients add column unit_cost numeric(18,7);
    alter table ingredients add column expiry_discarded_stock numeric not null default 0;
    alter table ingredients add column stock_expired_at timestamptz;
    update ingredients set unit_cost=17.25 where id=2;
    insert into ingredients(id,name,unit,current_stock,reorder_level,expires_on)
      values(8,'Expired Positive Stock','pcs',12,0,'2000-01-01');
    create schema cloud_sync;
    create table cloud_sync.records(marker text);
    insert into cloud_sync.records values('existing sync metadata');
  `);
  for (const name of ["zero_expired_ingredient_before_write", "record_expired_ingredient_loss"]) {
    const fn = expiryMigration.match(new RegExp(`create or replace function public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`));
    assert.ok(fn, `${name} production function is available`);
    await db.exec(fn[0]);
  }
  await db.exec(`
    create trigger zero_expired_ingredient_before_write before insert or update on ingredients
      for each row execute function public.zero_expired_ingredient_before_write();
    create trigger record_expired_ingredient_loss after insert or update on ingredients
      for each row execute function public.record_expired_ingredient_loss();
  `);
  return db;
}

test("cloud seed works without local sync, supports all requested charts and preserves expiry behavior", async () => {
  const db = await cloudFixture();
  try {
    const rows = async (sql) => (await db.query(sql)).rows;
    const beforeReal = await rows("select * from orders where order_number='REAL-KEEP'");
    const beforeExpired = await rows("select * from ingredients where id in (3,4,5,8) order by id");
    const beforeIndexes = await rows("select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname");
    await db.exec(seed);
    const [summary] = await rows(`select count(*)::int orders,count(distinct (created_at at time zone 'Asia/Manila')::date)::int days,
      min((created_at at time zone 'Asia/Manila')::date)::text first_day,
      max((created_at at time zone 'Asia/Manila')::date)::text last_day,
      count(*) filter(where status<>'Completed' or payment_status<>'Paid')::int incomplete
      from orders where order_number like 'DAYO-DEMO-Y1-%'`);
    assert.deepEqual(summary, { orders: 6009, days: 365, first_day: "2025-10-31", last_day: "2026-10-30", incomplete: 0 });
    const orders = await rows(`select o.*,coalesce(jsonb_agg(oi.*) filter(where oi.id is not null),'[]') order_items
      from orders o left join order_items oi on oi.order_id=o.id group by o.id`);
    const report = buildSalesReport(orders, await rows("select * from menu_items"), await rows("select * from menu_categories"));
    assert.equal(report.dailySales.length, 365);
    assert.ok(report.dailySales.every((d) => d.totalSales > 0));
    const revenue = buildRevenueTimeline(report.dailySales, "2026-10-01", "2026-10-30");
    assert.ok(revenue.totalSales > 0 && revenue.previousSales > 0);
    const customers = buildCustomerActivity(report.dailySales.map((d) => ({ date: d.date, count: d.totalOrders })), "weekly", "2026-10-30");
    assert.ok(customers.every((d) => d.count > 0));
    const movement = buildItemMovement(report.movementItems);
    assert.ok(movement.data.some((i) => i.movement === "fast"));
    assert.ok(movement.data.some((i) => i.movement === "slow"));
    assert.equal((await rows("select count(*)::int n from order_inventory_deductions"))[0].n, 6009);
    assert.deepEqual(await rows("select * from orders where order_number='REAL-KEEP'"), beforeReal);
    assert.deepEqual(await rows("select * from ingredients where id in (3,4,5,8) order by id"), beforeExpired);
    assert.equal(Number((await rows("select unit_cost from ingredients where id=2"))[0].unit_cost), 17.25);
    assert.equal((await rows("select count(*)::int n from stock_movements where adjustment<0"))[0].n, 0);
    assert.equal((await rows("select to_regnamespace('local_sync') present"))[0].present, null);
    assert.deepEqual(await rows("select * from cloud_sync.records"), [{ marker: "existing sync metadata" }]);
    assert.deepEqual(await rows("select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname"), beforeIndexes);

    const snapshot = async () => JSON.stringify(await rows(`select
      (select jsonb_agg(o order by id) from orders o) orders,
      (select jsonb_agg(i order by id) from order_items i) items,
      (select jsonb_agg(i order by id) from ingredients i) ingredients,
      (select jsonb_agg(m order by id) from stock_movements m) movements`));
    const beforeRepeat = await snapshot();
    await db.exec(seed);
    assert.equal(await snapshot(), beforeRepeat);
  } finally { await db.close(); }
});

test("cloud seed rejects incomplete pre-existing demo orders without changing them", async () => {
  const db = await cloudFixture();
  try {
    await db.exec(`insert into orders(order_number,customer_name,order_type,notes)
      values('DAYO-DEMO-Y1-20251031-001','Keep incomplete demo','Dine In',
      '[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.')`);
    await assert.rejects(db.exec(seed), /Existing tagged demo orders are incomplete/);
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::int n from orders")).rows[0].n, 2);
    assert.equal((await db.query("select status from orders where order_number='DAYO-DEMO-Y1-20251031-001'")).rows[0].status, "Pending");
  } finally { await db.close(); }
});
