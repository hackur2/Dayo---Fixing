import { useEffect, useState } from "react";
import { INVENTORY_REFRESH_EVENT } from "../utils/ingredientExpiryUtils";

export function useInventoryRefreshVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener(INVENTORY_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(INVENTORY_REFRESH_EVENT, refresh);
  }, []);
  return version;
}
