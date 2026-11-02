export function syncFailureMessage(error) {
  const suffix = typeof error?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code) ? ` [${error.code}]` : "";
  if (error?.code === "57014") return `Cloud PostgreSQL cancelled the upload because its statement timeout was exceeded.${suffix} Local records remain queued.`;
  if (error?.code === "PGRST003") return `The cloud API could not obtain a database connection before its timeout.${suffix} Local records remain queued for a safe retry.`;
  if (/timeout|timed? out|abort/i.test([error?.name, error?.message].join(" "))) return `The cloud upload request timed out before confirmation.${suffix} Local records remain queued for a safe retry.`;
  if (error?.status === 413) return "The cloud rejected the upload because the request was too large [HTTP 413]. Local records remain queued.";
  if (["PT409", "40001", "23505", "22023", "23503", "23514"].includes(error?.code)) {
    const message = String(error.message || "The cloud rejected the record schema or a database constraint.")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted JWT]")
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]").slice(0,500);
    return `${message}${suffix} Local records remain queued${["PT409", "40001", "23505"].includes(error.code) ? " for review; newer or independently changed cloud data was not overwritten" : ""}.`;
  }
  if (["PGRST202", "42883", "0A000"].includes(error?.code)) return `Cloud sync needs a server database update.${suffix} Local changes remain saved for retry.`;
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "The cloud rejected synchronization access. Local changes remain saved for retry.";
  return `Cloud sync could not finish.${suffix} Local changes remain queued. Check the server diagnostic for the failing stage.`;
}

// Report codes and classifications only. Database rows, request bodies,
// credentials and raw server messages never enter the diagnostic log.
export function syncFailureDiagnostic(error, stage) {
  const text = [error?.name, error?.message, error?.details].filter((value) => typeof value === "string").join(" ");
  const code = (value) => typeof value === "string" && /^[A-Z0-9_]{1,32}$/.test(value) ? value : null;
  return {
    stage,
    code: code(error?.code),
    cause_code: code(error?.cause?.code),
    status: Number.isInteger(error?.status) ? error.status : null,
    timeout_or_abort: /timeout|timed? out|abort|statement timeout/i.test(text) || ["57014", "PGRST003"].includes(error?.code),
    payload_too_large: /payload too large|request entity too large/i.test(text) || error?.status === 413,
    permission_denied: /permission denied/i.test(text) || error?.code === "42501",
    reason: syncFailureMessage(error),
  };
}

// The session lock covers both manual and scheduled runs, including across
// worker instances. A durable batch is retried verbatim after a lost response.
export async function processSyncRun({ pool, cloud, automatic = false, onError }) {
  const client = await pool.connect();
  let locked = false;
  let run;
  let stage = "prepare_run";
  try {
    locked = (await client.query("select pg_try_advisory_lock(8122,1) as locked")).rows[0].locked;
    if (!locked) return null;
    await client.query("update local_sync.sync_runs set status='failed',finished_at=clock_timestamp(),error='Sync was interrupted. Local changes remain queued for retry.' where status='running'");
    run = (await client.query("select * from local_sync.sync_runs where status='queued' order by created_at,id limit 1")).rows[0];
    if (!run && automatic) {
      const id = (await client.query("select local_sync.create_run('automatic') as id")).rows[0].id;
      run = (await client.query("select * from local_sync.sync_runs where id=$1", [id])).rows[0];
    }
    if (!run) return null;
    await client.query("update local_sync.sync_runs set status='running',started_at=clock_timestamp(),error=null where id=$1", [run.id]);
    const sourceId = (await client.query("select source_id from local_sync.settings")).rows[0].source_id;
    let confirmedAny = false;
    for (;;) {
      stage = "claim_local_batch";
      const batch = (await client.query("select local_sync.claim_batch($1) as batch", [run.id])).rows[0].batch;
      if (!batch) break;
      try {
        stage = "upload_cloud_batch";
        const { data, error, status } = await cloud.rpc("apply_cloud_sync_batch", {
          p_source_id: sourceId, p_batch_id: batch.id, p_events_json: batch.payload,
        });
        if (error) throw Object.assign(error, { status: error.status ?? status });
        if (data?.batch_id !== batch.id || data.record_count !== batch.record_count) throw new Error("Cloud confirmation did not match the batch.");
        // This local statement is a transaction. A failed acknowledgement leaves
        // the same batch pending; the cloud receipt makes its retry idempotent.
        stage = "acknowledge_local_batch";
        await client.query("select local_sync.finish_batch($1,$2)", [batch.id, run.id]);
        confirmedAny = true;
      } catch (error) {
        await client.query("select local_sync.finish_batch($1,$2,$3)", [batch.id, run.id, syncFailureMessage(error)]);
        throw error;
      }
    }
    if (!confirmedAny) {
      stage = "check_cloud_connection";
      // An empty queue must still confirm cloud connectivity before reporting
      // success or advancing the last successful sync time.
      const { data, error, status } = await cloud.rpc("apply_cloud_sync_batch", { p_source_id: sourceId, p_batch_id: run.id, p_events_json: "[]" });
      if (error) throw Object.assign(error, { status: error.status ?? status });
      if (data?.batch_id !== run.id || data.record_count !== 0) throw new Error("Cloud confirmation was invalid.");
    }
    stage = "finish_local_run";
    await client.query(`with finished as (
      update local_sync.sync_runs set status='succeeded',finished_at=clock_timestamp(),error=null where id=$1 returning finished_at
    ) update local_sync.settings set last_cloud_check_at=(select finished_at from finished)`, [run.id]);
  } catch (error) {
    // Logging must never prevent failure bookkeeping or release of the lock.
    try { onError?.(syncFailureDiagnostic(error, stage)); } catch { /* best-effort diagnostics */ }
    if (!run) throw error;
    await client.query("update local_sync.sync_runs set status='failed',finished_at=clock_timestamp(),error=$2 where id=$1", [run.id, syncFailureMessage(error)]);
  } finally {
    try { if (locked) await client.query("select pg_advisory_unlock(8122,1)"); }
    finally { client.release(); }
  }
  return run ? (await pool.query("select to_jsonb(r) as run from local_sync.sync_runs r where id=$1", [run.id])).rows[0].run : null;
}
