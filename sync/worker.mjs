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

async function heartbeat() {
  try {
    await pool.query("update local_sync.worker_status set configured=$1,heartbeat_at=clock_timestamp(),error=$2", [configured, configured ? null : "Cloud connection is not configured."]);
    previousSetupError = null;
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
