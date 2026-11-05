# Local and cloud inventory comparison

On 2026-11-06 the owner reported differences in Ingredients, Suppliers, Shelf Life, and Low Stock. The current code identifies which rows affect those views. The exact differences remain unknown until both databases are compared.

- Ingredients and Shelf Life both read active `public.ingredients` rows. Compare identity, stock, unit, cost, expiry, and archive state. [Ingredients service](../../../src/services/inventoryService.js#L18) · [Shelf Life service](../../../src/services/shelfLifeService.js#L7)
- Low Stock uses current stock and a reorder threshold calculated from completed-order deductions in `public.stock_movements` over the preceding 720 hours. A quantity of zero is Out of Stock. The page matches suppliers to ingredients using normalized names and the supplier's `product_type`. [Reorder source](../../../src/services/ingredientReorderService.js) · [Threshold calculation](../../../src/utils/ingredientReorderUtils.js) · [Stock status](../../../src/utils/inventoryUtils.js#L1) · [Supplier matching](../../../src/utils/lowStockUtils.js)
- `ingredients`, `suppliers`, and `stock_movements` are eligible sync tables. Confirm the inventory baseline and dependent recipe and order history before a local-to-cloud replacement. [Receiver allowlist](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql#L59) · [Sync scope](../../../sync/README.md#current-scope-the-past-hour)

## Read-only SQL for local and cloud

Run both queries in the local SQL Editor and again in the intended cloud project. Run them close together, or replace `now()` in both copies with the same `timestamptz` literal for an identical cutoff. Compare by ID and name to detect different data using the same ID. Supplier contacts are omitted. The inventory query reads stored values and does not invoke the app's expiry or reorder refresh RPCs.

```sql
with recent_usage as (
  select ingredient_id, sum(-adjustment) as used_in_completed_orders
  from public.stock_movements
  where created_at between now() - interval '720 hours' and now()
    and adjustment < 0
    and reason ilike 'Order % completed'
    and btrim(reason) ~* '^Order .+ completed$'
  group by ingredient_id
)
select i.id, i.name, i.category, i.unit, i.current_stock, i.unit_cost,
       i.expires_on, i.archived_at,
       coalesce(u.used_in_completed_orders, 0) as used_in_completed_orders,
       ceil(coalesce(u.used_in_completed_orders, 0) * 2000 / 30) / 1000
         as calculated_reorder_level
from public.ingredients i
left join recent_usage u on u.ingredient_id = i.id
order by i.id;
```

```sql
select id, name, product_type
from public.suppliers
order by id;
```
