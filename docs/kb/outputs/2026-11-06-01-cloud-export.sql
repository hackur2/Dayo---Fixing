-- CLOUD SQL EDITOR ONLY. Read-only. Copy the entire local_insert_sql cell.
-- The result contains business records. Keep it private and outside the repo.
with business as (
  select jsonb_build_object(
    'ingredients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ingredients t),
    'ingredient_archives', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.ingredient_archives t),
    'menu_categories', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_categories t),
    'menu_variant_sets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_variant_sets t),
    'menu_variant_options', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_variant_options t),
    'menu_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_items t),
    'menu_item_ingredients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_item_ingredients t),
    'menu_item_variants', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_item_variants t),
    'menu_item_variant_sets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.menu_item_variant_sets t),
    'combo_components', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.combo_components t),
    'orders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.orders t),
    'order_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.order_items t),
    'order_inventory_deductions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.order_inventory_deductions t),
    'stock_movements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.stock_movements t),
    'promotions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.promotions t),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.feedback t),
    'staff', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.staff t),
    'staff_shifts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.staff_shifts t),
    'suppliers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.suppliers t)
  ) as tables
), metadata as (
  select jsonb_object_agg(e.key, jsonb_array_length(e.value)) as counts,
         jsonb_object_agg(e.key, (
           select jsonb_agg(a.attname::text order by a.attname::text collate "C")
           from pg_attribute a
           where a.attrelid = to_regclass(format('public.%I', e.key))
             and a.attnum > 0 and not a.attisdropped
         )) as columns
  from business cross join lateral jsonb_each(tables) e
), snapshot as (
  select jsonb_build_object('format', 'dayo-business-v1', 'timezone', current_setting('TimeZone'), 'tables', tables,
                            'counts', counts, 'columns', columns) as payload,
         counts
  from business cross join metadata
)
select format('insert into pg_temp.dayo_cloud_snapshot values (%L::jsonb, %L);',
              payload::text, md5(payload::text)) as local_insert_sql,
       counts as cloud_row_counts
from snapshot
where current_user = 'postgres';
