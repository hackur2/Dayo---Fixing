-- DAYO DEMO ROP V1: estimated ingredient usage for existing annual demo orders.
-- Run the ENTIRE file in SQL Editor as postgres. Test on a copy first.
-- Only the rolling past 30 x 24 hours are included; order dates are not shifted.
-- Uses CURRENT recipes, so this is synthetic usage, not actual stock depletion.
-- No new orders, recipes, prices, indexes, expiry setup or sync retries.
-- Current stock is NEVER deducted again. Existing ledger rows are not rewritten.
-- The app already calculates ROP from this ledger, even without the ROP SQL RPC.

begin;
set local statement_timeout = '120s';
set local lock_timeout = '5s';
select pg_advisory_xact_lock(8122, 103026);
-- Serialize with other imports and protect the repeat-run check without an index.
lock table public.orders, public.order_items, public.menu_item_ingredients,
  public.ingredients, public.stock_movements in share row exclusive mode;

-- Do not enqueue historical demo usage for cloud upload.
set local app.sync_source = 'cloud_mirror';
do $$
declare capture_definition text;
begin
  if to_regprocedure('local_sync.capture_change()') is not null then
    select pg_get_functiondef('local_sync.capture_change()'::regprocedure) into capture_definition;
    if position('app.sync_source' in capture_definition) = 0
      or position('cloud_mirror' in capture_definition) = 0 then
      raise exception 'Local sync capture cannot exclude demo history. No changes made.';
    end if;
  end if;
end;
$$;

create temporary table _demo_rop_config on commit drop as
select clock_timestamp() as as_of,
  '[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.'::text as order_marker,
  '[DAYO DEMO ROP V1]'::text as usage_marker;

-- Guard against trigger side effects, including expiry stock clearing.
create temporary table _demo_rop_before_ingredients on commit drop as
select id, to_jsonb(i) - 'reorder_level' - 'updated_at' as protected_data
from public.ingredients i;
create temporary table _demo_rop_before_ledger on commit drop as
select id, to_jsonb(s) as row_data from public.stock_movements s;
create temporary table _demo_rop_before_inputs on commit drop as
select 'orders'::text as name, md5(coalesce(jsonb_agg(o order by id)::text, '[]')) as checksum
from public.orders o
union all
select 'order_items', md5(coalesce(jsonb_agg(oi order by id)::text, '[]')) from public.order_items oi
union all
select 'recipes', md5(coalesce(jsonb_agg(r order by menu_item_id, ingredient_id)::text, '[]'))
from public.menu_item_ingredients r;

create temporary table _demo_rop_orders on commit drop as
select o.id, o.order_number, o.created_at,
  'Order ' || o.order_number || ' ' || c.usage_marker || ' completed' as demo_reason,
  exists (
    select 1 from public.stock_movements s
    where s.adjustment < 0 and s.reason ~* '^Order .+ completed$'
      and position(c.usage_marker in s.reason) = 0
      and (s.order_id = o.id or lower(btrim(s.reason)) = lower('Order ' || o.order_number || ' completed'))
  ) as already_accounted
from public.orders o cross join _demo_rop_config c
where starts_with(o.order_number, 'DAYO-DEMO-Y1-')
  and o.notes = c.order_marker and o.status = 'Completed' and o.payment_status = 'Paid'
  and o.created_at >= c.as_of - interval '720 hours' and o.created_at <= c.as_of;

-- The normal completion calculation aggregates all lines per order/ingredient.
-- Recipe quantities are already expressed in each ingredient's stored unit.
create temporary table _demo_rop_expected on commit drop as
select o.id as order_id, o.order_number, o.created_at, o.demo_reason,
  i.id as ingredient_id, round(sum(oi.quantity * r.quantity), 3) as quantity
from _demo_rop_orders o
join public.order_items oi on oi.order_id = o.id
join public.menu_item_ingredients r on r.menu_item_id = oi.menu_item_id
join public.ingredients i on i.id = r.ingredient_id
where not o.already_accounted and to_jsonb(i)->>'archived_at' is null
group by o.id, o.order_number, o.created_at, o.demo_reason, i.id
having round(sum(oi.quantity * r.quantity), 3) > 0;

do $$
begin
  if not exists (select 1 from _demo_rop_orders) then
    raise exception 'No completed, paid, tagged demo orders in the past 30 days. Dates were not changed.';
  end if;
  if not exists (select 1 from _demo_rop_expected)
    and exists (select 1 from _demo_rop_orders where not already_accounted) then
    raise exception 'Recent demo orders have no usable ingredient recipes. No usage was invented.';
  end if;
  -- An existing tagged row must still match its order, recipe quantity and date.
  -- Recipe edits require review instead of silently rewriting sample history.
  if exists (
    select 1 from public.stock_movements s
    join _demo_rop_orders o on s.reason = o.demo_reason
    left join _demo_rop_expected e on e.order_id = o.id and e.ingredient_id = s.ingredient_id
    where e.order_id is null or s.order_id is distinct from e.order_id
      or s.adjustment is distinct from -e.quantity or s.created_at is distinct from e.created_at
  ) or exists (
    select 1 from public.stock_movements s join _demo_rop_orders o on s.reason = o.demo_reason
    group by s.reason, s.ingredient_id having count(*) > 1
  ) then
    raise exception 'Existing demo usage differs from current recipes, dates, or order links. Review before continuing.';
  end if;
end;
$$;

create temporary table _demo_rop_inserted on commit drop as
with inserted as (
  insert into public.stock_movements(ingredient_id, adjustment, reason, order_id, created_at)
  select e.ingredient_id, -e.quantity, e.demo_reason, e.order_id, e.created_at
  from _demo_rop_expected e
  where not exists (
    select 1 from public.stock_movements s
    where s.reason = e.demo_reason and s.ingredient_id = e.ingredient_id
  )
  order by e.created_at, e.order_id, e.ingredient_id
  returning id
)
select id from inserted;

do $$
begin
  if exists (
    select 1 from _demo_rop_before_ingredients b full join public.ingredients i on i.id = b.id
    where b.id is null or i.id is null
      or b.protected_data is distinct from (to_jsonb(i) - 'reorder_level' - 'updated_at')
  ) then
    raise exception 'An inventory trigger changed protected ingredient data. Entire demo import rolled back.';
  end if;
  if exists (
    select 1 from _demo_rop_before_ledger b full join public.stock_movements s on s.id = b.id
    where (b.id is not null and b.row_data is distinct from to_jsonb(s))
      or (b.id is null and not exists (select 1 from _demo_rop_inserted n where n.id = s.id))
  ) then
    raise exception 'An inventory trigger changed existing history or added extra movements. Entire demo import rolled back.';
  end if;
  if exists (
    select 1 from _demo_rop_before_inputs b join (
      select 'orders'::text as name, md5(coalesce(jsonb_agg(o order by id)::text, '[]')) as checksum from public.orders o
      union all
      select 'order_items', md5(coalesce(jsonb_agg(oi order by id)::text, '[]')) from public.order_items oi
      union all
      select 'recipes', md5(coalesce(jsonb_agg(r order by menu_item_id, ingredient_id)::text, '[]')) from public.menu_item_ingredients r
    ) a using (name) where a.checksum is distinct from b.checksum
  ) then
    raise exception 'An inventory trigger changed orders, order items, or recipes. Entire demo import rolled back.';
  end if;
end;
$$;

-- Reviewable totals; repeat runs report zero new movements.
select c.as_of, c.as_of - interval '720 hours' as window_start,
  (select count(*) from _demo_rop_orders) as recent_demo_orders,
  (select count(*) from _demo_rop_orders where already_accounted) as orders_with_existing_usage_skipped,
  (select count(*) from _demo_rop_inserted) as new_demo_movements,
  (select count(distinct ingredient_id) from _demo_rop_expected) as ingredients_with_demo_usage
from _demo_rop_config c;

-- Same formula used by the app: ROP = ADS * (1 lead-time day + 1 buffer day).
-- Includes any existing real usage in the rolling window; quantities stay unchanged.
with usage as (
  select s.ingredient_id, sum(-s.adjustment) as quantity_30_days,
    sum(-s.adjustment) filter (where position(c.usage_marker in s.reason) > 0) as demo_quantity_30_days
  from public.stock_movements s cross join _demo_rop_config c
  where s.adjustment < 0 and s.reason ~* '^Order .+ completed$'
    and s.created_at >= c.as_of - interval '720 hours' and s.created_at <= c.as_of
  group by s.ingredient_id
)
select i.id, i.name, i.unit, i.current_stock,
  coalesce(u.demo_quantity_30_days, 0) as demo_quantity_30_days,
  coalesce(u.quantity_30_days, 0) as total_quantity_30_days,
  coalesce(u.quantity_30_days, 0) / 30 as average_daily_usage,
  coalesce(u.quantity_30_days, 0) / 30 as safety_stock,
  ceil((coalesce(u.quantity_30_days, 0) / 30 * 2) * 1000) / 1000 as expected_reorder_point
from public.ingredients i left join usage u on u.ingredient_id = i.id
where to_jsonb(i)->>'archived_at' is null order by i.name;

commit;
