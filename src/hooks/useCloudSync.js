import { useCallback, useEffect, useRef, useState } from "react";
import { cloudSyncService } from "../services/cloudSyncService";

export function useCloudSync(service = cloudSyncService) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  const mounted = useRef(false);
  const requestedRun = useRef(null);
  const requesting = useRef(false);
  const reading = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    const current = generation.current;
    try {
      const data = await service.getStatus(requestedRun.current);
      if (mounted.current && current === generation.current) {
        setStatus(data); setError("");
        if (["succeeded", "failed"].includes(data.run?.status)) requestedRun.current = null;
      }
    } catch (failure) {
      if (mounted.current && current === generation.current) setError(failure.message);
    } finally { reading.current = false; }
  }, [service]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    const online = () => { setIsOnline(true); void refresh(); };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => {
      mounted.current = false; generation.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("online", online); window.removeEventListener("offline", offline);
    };
  }, [refresh]);

  const requestSync = async () => {
    if (requesting.current) return;
    requesting.current = true; generation.current += 1;
    setIsRequesting(true); setError("");
    try {
      const id = await service.requestSync();
      if (!mounted.current) return;
      requestedRun.current = id;
      setStatus((previous) => ({ ...previous, worker_available: true, run: { id, status: "queued", synced_count: 0, failed_count: 0 } }));
      await refresh();
    } catch (failure) {
      if (mounted.current) setError(failure.message);
    } finally {
      requesting.current = false;
      if (mounted.current) setIsRequesting(false);
    }
  };
  const isSyncing = isRequesting || (!error && status?.worker_available && ["queued", "running"].includes(status?.run?.status));
  return { status, error, isSyncing: Boolean(isSyncing), isOnline, requestSync };
}
