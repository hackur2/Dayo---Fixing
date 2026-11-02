import { useEffect, useState } from "react";

import { supplierService } from "../services/supplierService";

export function useSupplierData() {
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supplierService.getSuppliers()
      .then((rows) => {
        if (cancelled) return;
        setSuppliers(rows);
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || "Unable to load suppliers.");
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadVersion]);

  function reloadSuppliers() {
    setIsLoading(true);
    setLoadError("");
    setLoadVersion((current) => current + 1);
  }

  async function createSupplier(values) {
    setPendingAction("save");
    try {
      const supplier = await supplierService.createSupplier(values);
      setSuppliers((current) => [...current, supplier]);
      return supplier;
    } finally {
      setPendingAction(null);
    }
  }

  async function updateSupplier(id, values) {
    setPendingAction("save");
    try {
      const supplier = await supplierService.updateSupplier(id, values);
      setSuppliers((current) => current.map((row) => row.id === id ? supplier : row));
      return supplier;
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSuppliers(ids) {
    setPendingAction("delete");
    try {
      const deletedIds = await supplierService.deleteSuppliers(ids);
      setSuppliers((current) => current.filter((row) => !deletedIds.includes(row.id)));
      return deletedIds;
    } finally {
      setPendingAction(null);
    }
  }

  return {
    suppliers,
    isLoading,
    loadError,
    isSaving: pendingAction === "save",
    isDeleting: pendingAction === "delete",
    reloadSuppliers,
    createSupplier,
    updateSupplier,
    deleteSuppliers,
  };
}
