import { useEffect, useState } from "react";

import { menuService } from "../services/menuService";
import { normalizeMenuItems } from "../adapters/menuAdapter";
import { supabase } from "../lib/supabase";

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState([]);
  const [expiringIngredientContext, setExpiringIngredientContext] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let hasLoaded = false;
    let lastInventoryContextRefresh = 0;
    async function loadMenuItems() {
      try {
        if (!hasLoaded) setIsLoading(true);
        setErrorMessage("");

        const data = await menuService.getMenuItems();
        const normalizedMenuItems = normalizeMenuItems(data);

        setMenuItems(normalizedMenuItems);
        if (Date.now() - lastInventoryContextRefresh >= 60000) {
          lastInventoryContextRefresh = Date.now();
          menuService.getExpiringIngredientMenuContext(normalizedMenuItems)
            .then(setExpiringIngredientContext)
            .catch((error) => {
              console.warn("Expiring ingredient context is unavailable for Sumo AI:", error.message);
              setExpiringIngredientContext([]);
            });
        }
      } catch (error) {
        console.error("Unable to load menu items:", error.message);
        setErrorMessage(error.code === "PGRST202" && error.message?.includes("get_customer_menu")
          ? "Supabase is missing the customer menu function. Apply the ingredient-based menu migration, then refresh this page."
          : "Unable to load menu from Supabase. Please try again.");
      } finally {
        hasLoaded = true;
        setIsLoading(false);
      }
    }

    loadMenuItems();
    // Admin menu edits and stock changes appear without requiring a customer refresh.
    const refreshTimer = window.setInterval(loadMenuItems, 8000);
    const channel = supabase?.channel("customer-menu-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadMenuItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, loadMenuItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_item_variants" }, loadMenuItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_item_ingredients" }, loadMenuItems)
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, loadMenuItems)
      .subscribe();
    return () => {
      window.clearInterval(refreshTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return {
    menuItems,
    expiringIngredientContext,
    isLoading,
    errorMessage,
  };
}
