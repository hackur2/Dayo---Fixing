import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { createSupplierService } = await vite.ssrLoadModule("/src/services/supplierService.js");
after(() => vite.close());

const supplierRow = {
  id: 11,
  name: "Aling Rosa Trading",
  product_type: "Pechay",
  product_name: "Pechay",
  mobile: "0917 000 1011",
  address: "Quezon City, Metro Manila",
};

const formValues = {
  name: " Aling Rosa Trading ",
  ingredient: " Pechay ",
  mobile: " 0917 000 1011 ",
  address: " Quezon City, Metro Manila ",
  id: "SUP-999",
  created_at: "2000-01-01",
};

function mockApi(body, status = 200) {
  const requests = [];
  const client = createClient("https://supplier-test.supabase.co", "test-only-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (url, init) => {
        requests.push({
          url: new URL(url),
          method: init.method,
          body: init.body ? JSON.parse(init.body) : null,
          headers: new Headers(init.headers),
        });
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { service: createSupplierService(client), requests };
}

test("loads database rows in ID order and maps the directory's column names", async () => {
  const { service, requests } = mockApi([supplierRow, { ...supplierRow, id: 1001 }]);
  const suppliers = await service.getSuppliers();
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].url.pathname, "/rest/v1/suppliers");
  assert.equal(requests[0].url.searchParams.get("order"), "id.asc");
  assert.equal(suppliers[0].id, 11);
  assert.equal(suppliers[0].displayId, "SUP-011");
  assert.equal(suppliers[0].ingredient, "Pechay");
  assert.equal(Object.hasOwn(suppliers[0], "productName"), false);
  assert.equal(requests[0].url.searchParams.get("select").includes("product_name"), false);
  assert.equal(suppliers[1].displayId, "SUP-1001");
});

test("an empty database stays empty instead of showing browser samples", async () => {
  const { service } = mockApi([]);
  assert.deepEqual(await service.getSuppliers(), []);
});

test("ingredient options come from Inventory and are limited to 10 in a stable alphabetical order", async () => {
  const ingredients = [{ id: 7, name: "Garlic" }, { id: 2, name: "Pechay" }];
  const { service, requests } = mockApi(ingredients);
  assert.deepEqual(await service.getIngredientOptions(), ingredients);
  assert.equal(requests[0].url.pathname, "/rest/v1/ingredients");
  assert.equal(requests[0].url.searchParams.get("select"), "id,name");
  assert.equal(requests[0].url.searchParams.get("order"), "name.asc,id.asc");
  assert.equal(requests[0].url.searchParams.get("limit"), "10");
});

test("missing ingredients stay empty and ingredient read errors are surfaced", async () => {
  assert.deepEqual(await mockApi([]).service.getIngredientOptions(), []);
  await assert.rejects(mockApi({ code: "42501", message: "permission denied for table ingredients" }, 403).service.getIngredientOptions(), { code: "42501" });
});

test("surfaces database read errors rather than returning sample rows", async () => {
  const { service } = mockApi({ code: "42501", message: "permission denied for table suppliers" }, 403);
  await assert.rejects(service.getSuppliers(), { code: "42501" });
});

test("creates suppliers without a product-name input and supports the legacy required column", async () => {
  const { service, requests } = mockApi(supplierRow, 201);
  const saved = await service.createSupplier(formValues);
  assert.equal(requests[0].method, "POST");
  const { id, ...writableColumns } = supplierRow;
  assert.deepEqual(requests[0].body, writableColumns);
  assert.equal(requests[0].headers.get("prefer"), "return=representation");
  assert.equal(saved.id, id);
  assert.equal(saved.displayId, "SUP-011");
  assert.equal(Object.hasOwn(saved, "productName"), false);
});

test("updates by database ID without requiring or overwriting the old product name", async () => {
  const { service, requests } = mockApi({ ...supplierRow, product_name: "Old product", address: "New address" });
  const updated = await service.updateSupplier(11, { ...formValues, address: " New address " });
  assert.equal(requests[0].method, "PATCH");
  assert.equal(requests[0].url.searchParams.get("id"), "eq.11");
  assert.equal(requests[0].body.address, "New address");
  assert.equal(Object.hasOwn(requests[0].body, "product_name"), false);
  assert.equal(Object.hasOwn(requests[0].body, "id"), false);
  assert.equal(Object.hasOwn(requests[0].body, "created_at"), false);
  assert.equal(updated.id, 11);
  assert.equal(updated.address, "New address");
});

test("failed saves propagate the database error so the modal can keep its inputs", async () => {
  const { service } = mockApi({ code: "23514", message: "Mobile format is invalid" }, 400);
  await assert.rejects(service.createSupplier(formValues), { code: "23514" });
});

test("a missing or inaccessible update is not reported as a success", async () => {
  const { service } = mockApi({ code: "PGRST116", message: "The result contains 0 rows" }, 406);
  await assert.rejects(service.updateSupplier(11, formValues), { code: "PGRST116" });
});

test("bulk deletion filters by selected IDs and reports only rows actually deleted", async () => {
  const { service, requests } = mockApi([{ id: 11 }]);
  assert.deepEqual(await service.deleteSuppliers([11, 12]), [11]);
  assert.equal(requests[0].method, "DELETE");
  assert.equal(requests[0].url.searchParams.get("id"), "in.(11,12)");
  assert.equal(requests[0].url.searchParams.get("select"), "id");
});

test("a deletion blocked by row permissions does not silently remove rows from the UI", async () => {
  const { service } = mockApi([]);
  await assert.rejects(service.deleteSuppliers([11]), /No suppliers were deleted/);
});

test("an empty selection never sends a delete request", async () => {
  const { service, requests } = mockApi([]);
  assert.deepEqual(await service.deleteSuppliers([]), []);
  assert.equal(requests.length, 0);
});

test("missing Supabase configuration gives a clear error", async () => {
  await assert.rejects(createSupplierService(null).getSuppliers(), /Supabase is not configured/);
});
