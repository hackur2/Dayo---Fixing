import assert from "node:assert/strict";
import test from "node:test";

import { formatInventoryDate, getInventoryTimestamp } from "../src/utils/inventoryUtils.js";
import { deleteInventoryRecords } from "../src/utils/inventoryDeletionUtils.js";

test("last-updated dates use padded YYYY/MM/DD in Philippine time", () => {
  assert.equal(formatInventoryDate("2026-01-02T04:05:06Z"), "2026/01/02");
  assert.equal(formatInventoryDate("2026-10-26T17:00:00Z"), "2026/10/27");
  assert.equal(formatInventoryDate("2026-10-27T00:30:00+08:00"), "2026/10/27");
  assert.equal(formatInventoryDate("2026-10-27"), "2026/10/27");
});

test("missing or unreadable dates show a placeholder", () => {
  assert.equal(formatInventoryDate(null), "—");
  assert.equal(formatInventoryDate(""), "—");
  assert.equal(formatInventoryDate("not a date"), "—");
});

test("new inventory timestamps can be formatted without parsing locale-specific text", () => {
  const timestamp = getInventoryTimestamp();
  assert.equal(new Date(timestamp).toISOString(), timestamp);
  assert.match(formatInventoryDate(timestamp), /^\d{4}\/\d{2}\/\d{2}$/);
});

test("bulk deletion targets only the passed selection", async () => {
  const calls = [];
  const result = await deleteInventoryRecords(
    [{ id: 4, name: "Garlic" }, { id: 9, name: "Rice" }],
    async (id) => { calls.push(id); }
  );
  assert.deepEqual(calls, [4, 9]);
  assert.deepEqual(result, { deletedIds: [4, 9], errors: [] });
});

test("protected rows are not reported as deleted and do not stop other selected deletions", async () => {
  const calls = [];
  const result = await deleteInventoryRecords(
    [{ id: 1, name: "Rice" }, { id: 2, name: "Chicken" }, { id: 3, name: "Garlic" }],
    async (id) => {
      calls.push(id);
      if (id === 2) throw new Error("This ingredient has stock movement history and cannot be deleted.");
    }
  );
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(result.deletedIds, [1, 3]);
  assert.deepEqual(result.errors, [{
    id: 2,
    name: "Chicken",
    message: "This ingredient has stock movement history and cannot be deleted.",
  }]);
});

test("selected combos are deleted before their component menu items", async () => {
  const records = [
    { id: 1, name: "Adobo", type: "Ala Carte" },
    { id: 3, name: "Adobo Meal", type: "Combo" },
    { id: 2, name: "Rice", type: "Ala Carte" },
  ];
  const calls = [];
  await deleteInventoryRecords(records, async (id) => { calls.push(id); });
  assert.deepEqual(calls, [3, 1, 2]);
  assert.deepEqual(records.map((record) => record.id), [1, 3, 2]);
});

test("an empty selection makes no delete calls", async () => {
  const result = await deleteInventoryRecords([], () => assert.fail("Unexpected delete"));
  assert.deepEqual(result, { deletedIds: [], errors: [] });
});
