import { supabase } from "../lib/supabase";
import { normalizeIngredient } from "../adapters/inventoryAdapter";
import { synchronizeIngredientExpiry } from "./ingredientExpiryService";

export function createShelfLifeService(client) {
  return {
    async getIngredients() {
      await synchronizeIngredientExpiry(client);
      const ingredients = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client.from("ingredients")
          .select("*")
          .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = data ?? [];
        ingredients.push(...page.filter((row) => !row.archived_at).map(normalizeIngredient));
        if (page.length < pageSize) return ingredients;
      }
    },
  };
}

export const shelfLifeService = createShelfLifeService(supabase);
