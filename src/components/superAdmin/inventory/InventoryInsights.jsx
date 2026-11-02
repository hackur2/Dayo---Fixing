import { useMemo } from "react";
import { usePotentialExcessData } from "../../../hooks/usePotentialExcessData";
import ItemMovementCard from "../sales/ItemMovementCard";
import PotentialExcessCard from "./PotentialExcessCard";
import "../../../styles/inventoryInsights.css";

export default function InventoryInsights({ ingredients, menuItems }) {
  // Successful inventory edits replace these arrays and refresh both panels.
  const refreshKey = useMemo(() => ({ ingredients, menuItems }), [ingredients, menuItems]);
  const { estimate, isLoading, error } = usePotentialExcessData(refreshKey);
  return (
    <div className="inventory-insights" aria-label="Inventory insights">
      <PotentialExcessCard estimate={estimate} isLoading={isLoading} isUnavailable={isLoading || Boolean(error)} />
      <ItemMovementCard compact refreshKey={refreshKey} />
    </div>
  );
}
