# Inventory and reporting

Updated 2026-11-06. Verified against the current checkout and local tests. Human review is pending.

## Inventory and stock

- Menu categories and subcategories, item variants, direct ingredient recipes, and combo components are separate relational records. Some manual stock edits update the ingredient and append a movement through separate service calls. Order completion uses a database trigger to claim a deduction once, apply direct recipe quantities, and write stock movements. It rejects insufficient or expired stock. The cloud receiver requires a guard against duplicate deductions during replay. Combo revenue allocation expands components separately from stock deduction. [Inventory service](../../../src/services/inventoryService.js) · [Stock-only completion trigger](../../../supabase/migrations/20261029000001_expiry_stock_only.sql#L89) · [Safe receiver](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql)
- Expiry zeroes positive stock when the Philippine expiry date is reached and records the loss. The stock-only migration preserves the ingredient and recipes and restores earlier automatic archives at zero stock. Manual ingredient deletion uses a different RPC that saves a snapshot in the same transaction and blocks deletion when recipes or stock history reference the ingredient. Menu archive marks the original item inactive and unavailable and checks active combo dependencies. [Stock-only expiry](../../../supabase/migrations/20261029000001_expiry_stock_only.sql) · [Ingredient archive](../../../supabase/migrations/20261028000000_ingredient_archive.sql) · [Menu archive service](../../../src/services/menuArchiveService.js)
- Canonical inventory units are Pcs, Grams, and mL. Migration logic converts quantity and unit cost together and protects unit changes for in-use ingredients. The reorder point uses completed-order deductions from the last 720 hours divided by 30, multiplied by two, and rounded up to 0.001. [Units migration](../../../supabase/migrations/20261030000002_ingredient_units.sql) · [Reorder migration](../../../supabase/migrations/20261030000001_ingredient_reorder_points.sql)
- Suppliers live in a Super Admin-protected directory. Database-generated IDs render as `SUP-001` and similar labels. Low Stock matches supplier product types to normalized ingredient names. [Supplier migration](../../../supabase/migrations/20261030000004_suppliers.sql) · [Supplier service](../../../src/services/supplierService.js) · [Low Stock matching](../../../src/utils/lowStockUtils.js)
- Local and cloud inventory comparisons need the ingredient stock, expiry, and archive state, the supplier links, and recent completed-order stock deductions. Shelf Life reads active ingredient rows, and Low Stock can differ when the stock movement histories differ. [Shelf Life service](../../../src/services/shelfLifeService.js) · [Reorder service](../../../src/services/ingredientReorderService.js) · [Read-only inventory comparison](../outputs/2026-11-06-local-cloud-inventory-comparison.md)

## Reporting and staff

- Dashboard and Sales Graph use persisted orders and order-item subtotals for completed revenue. Date buckets use the Philippine calendar and order creation time. Dashboard activity excludes cancelled orders. [Dashboard service](../../../src/services/dashboardService.js) · [Dashboard dates](../../../src/utils/dashboardUtils.js) · [Sales Graph service](../../../src/services/salesGraphService.js)
- Ingredient revenue allocation uses current recipe costs and combo component quantities. Missing or incomplete costs can leave revenue Unallocated. Item Movement compares sales against a category-relative threshold. Potential Excess projects consumption through expiry from the last seven complete Philippine calendar days, using completed-order deductions. [Sales analysis](../../../src/utils/salesAnalysisUtils.js) · [Item Movement](../../../src/utils/salesReportUtils.js) · [Potential Excess](../../../src/utils/potentialExcessUtils.js)
- Staff Monitor uses `staff` and `staff_shifts` independently of Supabase login identities. Feedback is submitted through a customer RPC and read or marked reviewed through staff workflows. [Staff shift service](../../../src/services/staffShiftService.js) · [Feedback service](../../../src/services/feedbackService.js)

## Related topics

- [Ordering and access](ordering-and-access.md)
- [Deployment and sync](deployment-and-sync.md)
- [Verification and source map](verification.md)

<!-- kb:backlinks:start -->
## Backlinks

- [Wiki index](index.md)
- [Ordering and access](ordering-and-access.md)
- [Saved answers and wiki contributions](outputs.md)
- [System overview](system-overview.md)
- [Verification and source map](verification.md)
<!-- kb:backlinks:end -->
