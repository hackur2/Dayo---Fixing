import { supabase } from "../lib/supabase";

function syncError(error) {
  if (["PGRST202", "42883"].includes(error?.code)) return new Error("Cloud sync needs setup on the local server. Your local records remain saved.");
  if (error?.code === "42501") return new Error("Only an authorized Super Admin can synchronize data.");
  if (error?.code === "55000") return new Error("Cloud sync is unavailable. Check the local sync service; your local changes remain saved.");
  return new Error("Unable to reach the local sync service. Your changes remain saved. Check the connection and try again.");
}

export function createCloudSyncService(client) {
  async function rpc(name, args) {
    if (!client) throw syncError();
    let result;
    try { result = await client.rpc(name, args); } catch (error) { throw syncError(error); }
    if (result.error) throw syncError(result.error);
    return result.data;
  }
  return {
    async getStatus(runId = null) {
      const data = await rpc("get_cloud_sync_status", { p_run_id: runId });
      if (!data || ["pending_count", "failed_count", "skipped_count"].some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0)
        || (data.synced_count != null && (!Number.isSafeInteger(data.synced_count) || data.synced_count < 0))
        || (data.deferred_count != null && (!Number.isSafeInteger(data.deferred_count) || data.deferred_count < 0))
        || (data.window_seconds != null && (!Number.isSafeInteger(data.window_seconds) || data.window_seconds <= 0))
        || (data.last_cloud_check_at != null && !Number.isFinite(Date.parse(data.last_cloud_check_at)))
        || typeof data.worker_available !== "boolean"
        || (data.last_successful_sync_at != null && !Number.isFinite(Date.parse(data.last_successful_sync_at)))
        || (data.run && (!["queued", "running", "succeeded", "failed"].includes(data.run.status)
          || ["synced_count", "failed_count"].some((key) => !Number.isSafeInteger(data.run[key]) || data.run[key] < 0)))) throw syncError();
      return data;
    },
    async requestSync() {
      const id = await rpc("request_cloud_sync");
      if (typeof id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) throw syncError();
      return id;
    },
  };
}
export const cloudSyncService = createCloudSyncService(supabase);
