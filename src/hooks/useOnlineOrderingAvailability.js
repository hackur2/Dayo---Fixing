import { useCallback, useEffect, useState } from "react";

import { isLocalDeployment } from "../config/deployment";
import { onlineOrderingService } from "../services/onlineOrderingService";

const LOCAL_STATUS = { manual_enabled: true, local_online: true, effective_enabled: true };

export function useOnlineOrderingAvailability(service = onlineOrderingService) {
  const [status, setStatus] = useState(() => (isLocalDeployment ? LOCAL_STATUS : null));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (isLocalDeployment) return;
    try {
      const next = await service.getCustomerStatus();
      setStatus(next);
      setError("");
    } catch (failure) {
      setStatus(null);
      setError(failure.message || "Online ordering is unavailable.");
    }
  }, [service]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = isLocalDeployment ? null : window.setInterval(refresh, 10000);
    return () => {
      window.clearTimeout(initialRefresh);
      if (timer) window.clearInterval(timer);
    };
  }, [refresh]);

  return {
    status,
    error,
    isLoading: !isLocalDeployment && status === null && !error,
    isAvailable: Boolean(status?.effective_enabled),
    refresh,
  };
}
