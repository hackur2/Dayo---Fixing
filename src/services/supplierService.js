import { supabase } from "../lib/supabase";

const SUPPLIER_COLUMNS = "id,name,product_type,mobile,address";

function normalizeSupplier(row) {
  return {
    id: row.id,
    displayId: `SUP-${String(row.id).padStart(3, "0")}`,
    name: row.name,
    ingredient: row.product_type,
    mobile: row.mobile,
    address: row.address,
  };
}

function createSupplierPayload(values) {
  // IDs and timestamps are assigned by the database, including when editing.
  return {
    name: values.name.trim(),
    // Keep the existing database column compatible with the Supplier SQL setup.
    product_type: values.ingredient.trim(),
    mobile: values.mobile.trim(),
    address: values.address.trim(),
  };
}

export function createSupplierService(client) {
  function table(name = "suppliers") {
    if (!client) throw new Error("Supabase is not configured.");
    return client.from(name);
  }

  return {
    async getIngredientOptions() {
      const { data, error } = await table("ingredients")
        .select("id,name")
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },

    async getSuppliers() {
      const { data, error } = await table()
        .select(SUPPLIER_COLUMNS)
        .order("id", { ascending: true });
      if (error) throw error;
      return (data || []).map(normalizeSupplier);
    },

    async createSupplier(values) {
      const payload = createSupplierPayload(values);
      const { data, error } = await table()
        // The legacy schema may require product_name; no separate form input is needed.
        .insert({ ...payload, product_name: payload.product_type })
        .select(SUPPLIER_COLUMNS)
        .single();
      if (error) throw error;
      return normalizeSupplier(data);
    },

    async updateSupplier(id, values) {
      const { data, error } = await table()
        .update(createSupplierPayload(values))
        .eq("id", id)
        .select(SUPPLIER_COLUMNS)
        .single();
      if (error) throw error;
      return normalizeSupplier(data);
    },

    async deleteSuppliers(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await table().delete().in("id", ids).select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("No suppliers were deleted. Refresh the page and check your account permissions.");
      }
      return data.map((row) => row.id);
    },
  };
}

export const supplierService = createSupplierService(supabase);
