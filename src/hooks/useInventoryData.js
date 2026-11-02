import { useEffect, useState } from "react";
import { inventoryService } from "../services/inventoryService";
import { useInventoryRefreshVersion } from "./useInventoryRefreshVersion";
import { createAlaCartePayload, createComboPayload, createIngredientPayload, createSubCategoryPayload,
  normalizeIngredient, normalizeIngredients, normalizeInventoryMenuItem, normalizeInventoryMenuItems,
  normalizeMainCategories, normalizeSubCategories } from "../adapters/inventoryAdapter";

export function useInventoryData() {
  const [ingredients, setIngredients] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryActionError, setInventoryActionError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const inventoryVersion = useInventoryRefreshVersion();

  useEffect(() => {
    let active = true;
    Promise.all([
        inventoryService.getIngredients(), inventoryService.getMainCategories(),
        inventoryService.getSubCategories(), inventoryService.getMenuItems(),
      ]).then(([ingredientsData, mainData, subData, menuData]) => {
      if (!active) return;
      setInventoryError("");
      setIngredients(normalizeIngredients(ingredientsData));
      setMainCategories(normalizeMainCategories(mainData));
      setSubCategories(normalizeSubCategories(subData));
      setMenuItems(normalizeInventoryMenuItems(menuData));
    }).catch((error) => {
      console.error("Unable to load inventory:", error.message);
      if (active) setInventoryError("Unable to load inventory from Supabase.");
    }).finally(() => { if (active) setIsInventoryLoading(false); });
    return () => { active = false; };
  }, [loadVersion, inventoryVersion]);

  function loadInventoryData() {
    setIsInventoryLoading(true); setInventoryError(""); setLoadVersion((current) => current + 1);
  }

  async function runAction(action) {
    try { setInventoryActionError(""); return await action(); }
    catch (error) { setInventoryActionError(error.message || "Inventory update failed."); throw error; }
  }
  const addSubCategory = (form) => runAction(async () => {
    const row = await inventoryService.createSubCategory(createSubCategoryPayload(form));
    const value = normalizeSubCategories([row])[0]; setSubCategories((rows) => [...rows, value]); return value;
  });
  const addIngredient = (form) => runAction(async () => {
    const row = normalizeIngredient(await inventoryService.createIngredient(createIngredientPayload(form)));
    setIngredients((rows) => row.archivedAt ? rows : [...rows, row]); return row;
  });
  const addAlaCarteMenuItem = (form) => runAction(async () => {
    const row = normalizeInventoryMenuItem(await inventoryService.createMenuItem(createAlaCartePayload(form)));
    setMenuItems((rows) => [...rows, row]); return row;
  });
  const addComboMenuItem = (form) => runAction(async () => {
    const row = normalizeInventoryMenuItem(await inventoryService.createComboItem(createComboPayload(form)));
    setMenuItems((rows) => [...rows, row]); return row;
  });
  const updateIngredientStock = (id, amount) => runAction(async () => {
    const row = normalizeIngredient(await inventoryService.updateIngredientStock(id, { adjustmentAmount: amount }));
    setIngredients((rows) => rows.map((item) => item.id === id ? row : item)); return row;
  });
  const updateIngredient = (id, payload) => runAction(async () => {
    const row = normalizeIngredient(await inventoryService.updateIngredient(id, payload));
    setIngredients((rows) => row.archivedAt ? rows.filter((item) => item.id !== id) : rows.map((item) => item.id === id ? row : item)); return row;
  });
  const updateMenuItem = (id, payload) => runAction(async () => {
    const row = normalizeInventoryMenuItem(await inventoryService.updateMenuItem(id, payload));
    setMenuItems((rows) => rows.map((item) => item.id === id ? row : item)); return row;
  });
  const deleteMenuItem = (id) => runAction(async () => {
    await inventoryService.deleteMenuItem(id);
    setMenuItems((rows) => rows.filter((item) => item.id !== id));
  });
  const deleteIngredient = (id) => runAction(async () => {
    await inventoryService.deleteIngredient(id);
    setIngredients((rows) => rows.filter((item) => item.id !== id));
  });

  return { ingredients, mainCategories, subCategories, menuItems, isInventoryLoading, inventoryError,
    inventoryActionError, addSubCategory, addIngredient, addAlaCarteMenuItem, addComboMenuItem,
    updateIngredientStock, updateIngredient, updateMenuItem, deleteIngredient, deleteMenuItem, reloadInventory: loadInventoryData };
}
