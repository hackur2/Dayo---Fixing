# Missing local tables

Applied to the local `supabase_db_Dayo--main` database on October 30, 2026:

- `20261028000000_ingredient_archive.sql`: creates the ingredient archive table, archive RPC, snapshot trigger, Super Admin access policy, and archive capture trigger for existing local sync installations.
- `20261030000004_suppliers.sql`: creates the supplier directory fields used by `src/services/supplierService.js`, identity IDs, timestamps, and Super Admin access policies. Supplier capture is installed only when the upgraded sync helpers support it; the currently installed legacy receiver does not support suppliers.

The complete repeatable SQL Editor script is `local_missing_tables_setup.sql`. It records only these two migration versions and verifies that every pre-existing public table and the local sync queue retain exactly the same rows before committing. On an editor error, run `rollback;` before retrying the complete file.

Verification after commit: **21 public tables**, 11 existing orders, 21 existing ingredients, 66 existing sync queue entries, zero ingredient archives, and zero suppliers. Both new tables have Row Level Security enabled. Cloud records were not imported.

The supplier structure follows the application's required columns (`id`, `name`, `product_type`, `product_name`, `mobile`, `address`) and adds creation/update timestamps. The cloud dashboard's complete table definition could not be inspected because Computer Use stopped when it could not verify the browser URL. Matching table names does not establish complete cloud/local schema parity.

Other pending migrations, including expiry, costs, unit conversion, and the sync upgrade, were not applied by this task. The analytics sample-year script remains unapplied.

Validation: `node --test --test-concurrency=1 tests/suppliersSql.test.mjs tests/ingredientArchiveSql.test.mjs` passed all 12 tests. The combined script also passed a rollback validation against the running local database before the actual commit.
