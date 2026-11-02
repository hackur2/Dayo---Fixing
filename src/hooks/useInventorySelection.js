import { useState } from "react";

export function useInventorySelection(visibleRows) {
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedRows = visibleRows.filter((row) => selectedIds.includes(row.id));
  const allSelected = visibleRows.length > 0 && selectedRows.length === visibleRows.length;

  function toggleSelection(id) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  }

  function toggleAll() {
    const visibleIds = visibleRows.map((row) => row.id);
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function clearDeleted(deletedIds) {
    setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)));
  }

  return { selectedRows, allSelected, toggleSelection, toggleAll, clearSelection, clearDeleted };
}
