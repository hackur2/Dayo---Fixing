import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { processSyncRun } from "./engine.mjs";

const { Pool } = pg;
const intervalMs = Math.max(10000, Number(process.env.SYNC_INTERVAL_MS) || 300000);
const pollMs = Math.max(1000, Number(process.env.SYNC_POLL_MS) || 2000);
const remoteOrderPullMs = Math.max(1000, Number(process.env.REMOTE_ORDER_PULL_MS) || 2000);
const requestTimeoutMs = Math.min(300000, Math.max(5000, Number(process.env.SYNC_REQUEST_TIMEOUT_MS) || 180000));
const localDatabaseUrl = process.env.LOCAL_DATABASE_URL;
const cloudUrl = process.env.CLOUD_SUPABASE_URL;
const cloudServiceKey = process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY;

if (!localDatabaseUrl) {
  console.error("Local cloud sync is disabled: LOCAL_DATABASE_URL is not set.");
  process.exit(1);
}

const configured = Boolean(cloudUrl && cloudServiceKey);
const pool = new Pool({ connectionString: localDatabaseUrl, max: 3, connectionTimeoutMillis: 5000 });
const cloud = configured ? createClient(cloudUrl, cloudServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) }) },
  }) : null;
let activeRun;
let lastAutomatic = 0;
let stopping = false;
let previousSetupError;
let previousAvailabilityError;
let previousRemoteOrderError;
let availabilityReporting = false;
let lastRemoteOrderPull = 0;

// Vercel customer orders are created on the cloud database, while the kitchen
// UI deliberately stays connected to the local database.  Keep the active
// cloud orders mirrored locally so the KDS can work on the restaurant LAN.
// app.sync_source makes the local outbox trigger ignore these received rows;
// when the kitchen changes a status normally, that local change is still
// captured and sent back to the cloud by the existing sync pipeline.
async function pullActiveCloudOrders() {
  if (!configured || Date.now() - lastRemoteOrderPull < remoteOrderPullMs) return;
  lastRemoteOrderPull = Date.now();

  try {
    const { data: orders, error } = await cloud.rpc("get_active_orders_for_local_kds");
    if (error) throw error;

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.sync_source', 'cloud_mirror', true)");
      for (const record of orders ?? []) {
        const { order: orderRow, items = [] } = record;
        // Both databases use compatible schemas. jsonb_populate_record keeps
        // this receiver resilient to optional columns added by migrations.
        await client.query(`insert into public.orders (
            id, order_number, customer_name, order_type, source, payment_method,
            payment_reference_number, payment_status, notes, status, created_by,
            created_at, updated_at
          ) select
            id, order_number, customer_name, order_type, source, payment_method,
            payment_reference_number, payment_status, notes, status, created_by,
            created_at, updated_at
          from jsonb_populate_record(null::public.orders, $1::jsonb)
          on conflict (id) do update set
            order_number=excluded.order_number, customer_name=excluded.customer_name,
            order_type=excluded.order_type, source=excluded.source,
            payment_method=excluded.payment_method,
            payment_reference_number=excluded.payment_reference_number,
            payment_status=excluded.payment_status, notes=excluded.notes,
            status=excluded.status, created_by=excluded.created_by,
            created_at=excluded.created_at, updated_at=excluded.updated_at`, [JSON.stringify(orderRow)]);
        for (const item of items) {
          await client.query(`insert into public.order_items (
              id, order_id, menu_item_id, item_name, selected_variant_key,
              variant_label, unit_price, quantity, recommendation_source
            ) select
              id, order_id, menu_item_id, item_name, selected_variant_key,
              variant_label, unit_price, quantity, recommendation_source
            from jsonb_populate_record(null::public.order_items, $1::jsonb)
            on conflict (id) do update set
              order_id=excluded.order_id, menu_item_id=excluded.menu_item_id,
              item_name=excluded.item_name, selected_variant_key=excluded.selected_variant_key,
              variant_label=excluded.variant_label, unit_price=excluded.unit_price,
              quantity=excluded.quantity,
              recommendation_source=excluded.recommendation_source`, [JSON.stringify(item)]);
        }
      }
      // Rows arrive with cloud-assigned bigint IDs. Advance local sequences so
      // later local inserts cannot reuse one of those IDs.
      await client.query(`select setval(pg_get_serial_sequence('public.orders', 'id'),
        coalesce((select max(id) from public.orders), 1), true)`);
      await client.query(`select setval(pg_get_serial_sequence('public.order_items', 'id'),
        coalesce((select max(id) from public.order_items), 1), true)`);
      await client.query("commit");
      previousRemoteOrderError = null;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (previousRemoteOrderError !== error?.code) {
      console.error("Cloud orders could not be delivered to the local KDS.", JSON.stringify({
        code: typeof error?.code === "string" ? error.code : null,
        status: Number.isInteger(error?.status) ? error.status : null,
      }));
    }
    previousRemoteOrderError = error?.code;
  }
}

async function reportOnlineOrderingAvailability() {
  if (!configured || availabilityReporting) return;
  availabilityReporting = true;
  try {
    const { rows } = await pool.query("select online_ordering_enabled from local_sync.settings where singleton=true");
    const enabled = Boolean(rows[0]?.online_ordering_enabled);
    const { error } = await cloud.rpc("report_local_online_ordering", { p_enabled: enabled });
    if (error) throw error;

    // The local DB records only a confirmed cloud report. This makes the
    // dashboard show Offline immediately when the internet/cloud is lost.
    await pool.query(`update local_sync.settings
      set last_online_ordering_report_at=clock_timestamp(),online_ordering_error=null
      where singleton=true`);
    await pool.query(`update public.online_ordering_status
      set manual_enabled=$1,local_heartbeat_at=clock_timestamp(),updated_at=clock_timestamp()
      where singleton=true`, [enabled]);
    previousAvailabilityError = null;
  } catch (error) {
    try {
      await pool.query("update local_sync.settings set online_ordering_error='Cloud availability report failed.' where singleton=true");
    } catch { /* local setup may not have been applied yet */ }
    if (previousAvailabilityError !== error?.code) {
      console.error("Online ordering availability could not reach the cloud; Vercel ordering will remain unavailable.");
    }
    previousAvailabilityError = error?.code;
  } finally {
    availabilityReporting = false;
  }
}

async function heartbeat() {
  try {
    await pool.query("update local_sync.worker_status set configured=$1,heartbeat_at=clock_timestamp(),error=$2", [configured, configured ? null : "Cloud connection is not configured."]);
    previousSetupError = null;
    await reportOnlineOrderingAvailability();
  } catch (error) {
    if (previousSetupError !== error.code) console.error("Cloud sync needs local database setup or a database connection.");
    previousSetupError = error.code;
  }
}

async function poll() {
  if (stopping || activeRun || !configured) return;
  await pullActiveCloudOrders();
  const automatic = Date.now() - lastAutomatic >= intervalMs;
  if (automatic) lastAutomatic = Date.now();
  activeRun = processSyncRun({
    pool, cloud, automatic,
    onError: (diagnostic) => console.error("Cloud sync diagnostic:", JSON.stringify(diagnostic)),
  }).then((run) => {
    if (run) console.log(`Cloud sync ${run.status}: ${run.synced_count} confirmed, ${run.failed_count} failed.`);
  }).catch(() => { console.error("Cloud sync is unavailable; local records remain saved."); }).finally(() => { activeRun = null; });
  await activeRun;
}
await heartbeat();
const heartbeatTimer = setInterval(heartbeat, 5000);
const pollTimer = setInterval(poll, pollMs);
await poll();
async function shutdown() {
  stopping = true;
  clearInterval(pollTimer); clearInterval(heartbeatTimer);
  if (activeRun) await activeRun;
  await pool.end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
