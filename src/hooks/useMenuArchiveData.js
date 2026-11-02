import { useEffect, useState } from "react";
import { menuArchiveService } from "../services/menuArchiveService";
import { useInventoryRefreshVersion } from "./useInventoryRefreshVersion";

export function useMenuArchiveData() {
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();

  useEffect(() => {
    let cancelled = false;
    menuArchiveService.getArchivedMenuItems().then((rows) => {
      if (!cancelled) { setMenuItems(rows); setLoadError(""); }
    }).catch((error) => {
      if (!cancelled) setLoadError(error.message || "Unable to load archived menu items.");
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [version, inventoryVersion]);

  function reload() {
    setIsLoading(true); setLoadError(""); setVersion((value) => value + 1);
  }
  return { menuItems, isLoading, loadError, reload };
}
