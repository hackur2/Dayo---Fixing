import { useCallback, useEffect, useRef, useState } from "react";

import { onlineOrderingService } from "../services/onlineOrderingService";

export function useLocalOnlineOrderingControl(service = onlineOrderingService) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const reading = useRef(false);

  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const next = await service.getLocalStatus();
      setStatus(next);
      setError("");
    } catch (failure) {
      setError(failure.message || "Unable to read online-ordering status.");
    } finally {
      reading.current = false;
    }
  }, [service]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(refresh, 5000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(timer); };
  }, [refresh]);

  const setEnabled = useCallback(async (enabled) => {
    setIsSaving(true);
    setError("");
    try {
      await service.setLocalEnabled(enabled);
      await refresh();
    } catch (failure) {
      setError(failure.message || "Unable to update online ordering.");
    } finally {
      setIsSaving(false);
    }
  }, [refresh, service]);

  return { status, error, isSaving, setEnabled };
}
