export async function deleteInventoryRecords(records, deleteRecord) {
  const deletedIds = [];
  const errors = [];
  // Removing selected combos first releases their component references.
  const orderedRecords = [...records].sort((first, second) =>
    Number(second.type === "Combo") - Number(first.type === "Combo"));

  for (const record of orderedRecords) {
    try {
      await deleteRecord(record.id);
      deletedIds.push(record.id);
    } catch (error) {
      errors.push({
        id: record.id,
        name: record.name,
        message: error.message || "Unable to archive this record.",
      });
    }
  }

  return { deletedIds, errors };
}
