import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { processSyncRun } from "./engine.mjs";

const { Pool } = pg;
const intervalMs = Math.max(10000, Number(process.env.SYNC_INTERVAL_MS) || 300000);
const pollMs = Math.max(1000, Number(process.env.SYNC_POLL_MS) || 2000);
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
let availabilityReporting = false;

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
