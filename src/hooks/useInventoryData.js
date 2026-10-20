import { useEffect, useState } from "react";
import { inventoryService } from "../services/inventoryService";
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

  async function loadInventoryData() {
    try {
      setIsInventoryLoading(true); setInventoryError("");
      const [ingredientsData, mainData, subData, menuData] = await Promise.all([
        inventoryService.getIngredients(), inventoryService.getMainCategories(),
        inventoryService.getSubCategories(), inventoryService.getMenuItems(),
      ]);
      setIngredients(normalizeIngredients(ingredientsData));
      setMainCategories(normalizeMainCategories(mainData));
      setSubCategories(normalizeSubCategories(subData));
      setMenuItems(normalizeInventoryMenuItems(menuData));
    } catch (error) {
      console.error("Unable to load inventory:", error.message);
      setInventoryError("Unable to load inventory from Supabase.");
    } finally { setIsInventoryLoading(false); }
  }
  useEffect(() => { loadInventoryData(); }, []);

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
    setIngredients((rows) => [...rows, row]); return row;
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
    setIngredients((rows) => rows.map((item) => item.id === id ? row : item)); return row;
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
