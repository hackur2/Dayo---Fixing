import { supabase } from "../lib/supabase";
import { normalizeIngredient } from "../adapters/inventoryAdapter";

function archiveError(error) {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) {
    return new Error("Ingredient Archive is not available yet. Complete the database setup before archiving ingredients.");
  }
  if (error.message?.includes("cannot be deleted") || error.message?.includes("before deleting it")) {
    return new Error(error.message.replace("cannot be deleted", "cannot be archived").replace("before deleting it", "before archiving it"));
  }
  return error;
}

export function createIngredientArchiveService(client) {
  return {
    async getArchivedIngredients() {
      const records = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client.from("ingredient_archives")
          .select("*")
          .order("archived_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw archiveError(error);
        const page = data ?? [];
        records.push(...page.filter((row) => !row.restored_at).map((row) => ({
          ...normalizeIngredient(row.ingredient_data ?? {}),
          id: row.id, ingredientId: row.ingredient_id, archivedAt: row.archived_at, archiveReason: row.archive_reason ?? "deleted",
        })));
        if (page.length < pageSize) return records;
      }
    },
    async deleteIngredient(id) {
      const { data, error } = await client.rpc("delete_ingredient_to_archive", { p_ingredient_id: id });
      if (error) throw archiveError(error);
      if (String(data) !== String(id)) throw new Error("Ingredient was not archived. Refresh the inventory and try again.");
    },
  };
}

export const ingredientArchiveService = createIngredientArchiveService(supabase);
