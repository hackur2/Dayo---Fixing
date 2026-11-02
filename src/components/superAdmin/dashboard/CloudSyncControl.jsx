import { useCloudSync } from "../../../hooks/useCloudSync";

function formatSyncTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date);
}

export default function CloudSyncControl() {
  const { status, error, isSyncing, isOnline, requestSync } = useCloudSync();
  const run = status?.run;
  const failure = error || (run?.status === "failed" ? run.error || "Sync failed. Your local changes remain saved for retry." : "");
  const message = failure || (status?.worker_available === false ? "Cloud sync service is unavailable. Local changes remain saved." : "");
  return <aside className="dashboard-cloud-sync" aria-label="Cloud synchronization">
    <button type="button" className="primary-button dashboard-sync-button" onClick={requestSync} disabled={isSyncing} aria-busy={isSyncing}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17H6a4 4 0 0 1-.7-7.94A6 6 0 0 1 17 7.5a4.75 4.75 0 0 1 1 9.4M12 21V11m-4 4 4-4 4 4" /></svg>
      {isSyncing ? "Syncing…" : "Sync to Cloud"}
    </button>
    <p className="dashboard-sync-time">Last successful sync: <strong>{status ? formatSyncTime(status.last_successful_sync_at) : "—"}</strong></p>
    {status?.last_cloud_check_at && <p className="dashboard-sync-time">Last successful cloud check: <strong>{formatSyncTime(status.last_cloud_check_at)}</strong></p>}
    {message && <p className={`dashboard-sync-message${failure || status?.worker_available === false ? " error" : ""}`} role={failure ? "alert" : "status"}>{message}</p>}
    {!isOnline && <p className="dashboard-sync-message error" role="status">You appear to be offline. Local changes are saved; try syncing again when the connection returns.</p>}
  </aside>;
}
