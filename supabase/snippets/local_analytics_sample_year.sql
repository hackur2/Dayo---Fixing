-- LOCAL SUPABASE SQL EDITOR ONLY. Run this entire file once, then refresh Dayo.
-- Approved scope: sample sales for 2025-10-31 through 2026-10-30 (Manila),
-- refill eligible zero quantities, add unit_cost, fill missing/zero sample costs.
-- These are demonstration prices and sales, not actual business records.
-- Existing orders, positive quantities/costs, recipes and expiry dates are kept.
-- Historical demo sales do NOT consume today's inventory or queue cloud sync.
-- Derived views (Total Orders, Top Menu, sources, revenue breakdown) also update.

begin;
set local statement_timeout = '120s';
-- Serialize repeat runs of this sample import.
select pg_advisory_xact_lock(8122, 103026);

-- Both installed local-sync versions recognize this transaction-only setting.
-- It resets automatically at COMMIT/ROLLBACK; it does not stop the sync worker.
set local app.sync_source = 'cloud_mirror';

create temporary table _dayo_demo_config on commit drop as
select date '2025-10-31' as start_date, date '2026-10-30' as end_date,
       'DAYO-DEMO-Y1-'::text as prefix,
       '[DAYO DEMO YEAR V1] Synthetic analytics data; not a real sale.'::text as marker,
       clock_timestamp() as run_at;

do $$
declare v_capture text;
begin
  if (select end_date < start_date or end_date > (run_at at time zone 'Asia/Manila')::date
      from _dayo_demo_config) then
    raise exception 'Sample dates must be in the past or today (Asia/Manila).';
  end if;
  if to_regprocedure('local_sync.capture_change()') is not null then
    select pg_get_functiondef('local_sync.capture_change()'::regprocedure) into v_capture;
    if position('app.sync_source' in v_capture) = 0 or position('cloud_mirror' in v_capture) = 0 then
      raise exception 'Local sync capture cannot exclude this demo import. Review sync setup before running.';
    end if;
  end if;
  if exists (
    select 1 from public.orders o cross join _dayo_demo_config c
    where starts_with(o.order_number, c.prefix) and o.notes is distinct from c.marker
  ) then
    raise exception 'Reserved demo order prefix is already used by other records. No changes made.';
  end if;
end;
$$;

-- Approved sample-cost field. Does not change an existing column's precision.
alter table public.ingredients
  add column if not exists unit_cost numeric(18,7) check (unit_cost >= 0);

-- Match the report's comparison categories: subcategory first, then category.
-- Use shared variants when configured, otherwise per-item variants/base price.
create temporary table _dayo_demo_menu on commit drop as
with ranked as (
  select m.id, m.name, m.price,
         row_number() over (
           partition by coalesce(m.subcategory_id, m.category_id) order by m.id
         ) as category_rank,
         count(*) over (partition by coalesce(m.subcategory_id, m.category_id)) as category_size
  from public.menu_items m
  where m.is_active and (
    m.price > 0
    or exists (select 1 from public.menu_item_variants v where v.menu_item_id = m.id and v.price > 0)
    or exists (
      select 1 from public.menu_item_variant_sets s
      join public.menu_variant_options v on v.variant_set_id = s.variant_set_id
      where s.menu_item_id = m.id and v.price > 0
    )
  )
)
select r.*, v.options,
       case when r.category_rank <= greatest(1, ceil(r.category_size / 3.0)) then 18
            when r.category_rank <= greatest(1, ceil(r.category_size * 2 / 3.0)) then 5
            else 1 end as weight
from ranked r cross join lateral (
  select jsonb_agg(jsonb_build_object('key', choices.variant_key,
         'label', choices.name, 'price', choices.price)
         order by choices.sort_order, choices.variant_key) as options
  from (
    select v.variant_key, v.name, v.price, v.sort_order
    from public.menu_item_variant_sets s
    join public.menu_variant_options v on v.variant_set_id = s.variant_set_id
    where s.menu_item_id = r.id and v.price > 0
    union all
    select v.variant_key, v.name, v.price, v.sort_order
    from public.menu_item_variants v
    where v.menu_item_id = r.id and v.price > 0
      and not exists (select 1 from public.menu_item_variant_sets s where s.menu_item_id = r.id)
    union all
    select null::text, null::text, r.price, 0
    where r.price > 0
      and not exists (select 1 from public.menu_item_variant_sets s where s.menu_item_id = r.id)
      and not exists (select 1 from public.menu_item_variants v where v.menu_item_id = r.id)
  ) choices
) v where v.options is not null;

do $$
begin
  if not exists (select 1 from _dayo_demo_menu) then
    raise exception 'No active menu items have a positive price. Add/price menu items before seeding sales.';
  end if;
end;
$$;

create temporary table _dayo_demo_pool on commit drop as
select row_number() over (order by m.id, copies.n)::integer as ticket, m.id
from _dayo_demo_menu m cross join lateral generate_series(1, m.weight) copies(n);

-- Daily demand varies by weekday, month, growth over the year and daily noise.
-- Number of orders and line quantities both vary, including small repeat sales.
create temporary table _dayo_demo_plan on commit drop as
with days as (
  select c.*, c.start_date + d.n as sale_date, d.n as day_index
  from _dayo_demo_config c
  cross join lateral generate_series(0, c.end_date - c.start_date) d(n)
)
select d.sale_date, d.day_index, slots.n as slot,
       d.prefix || to_char(d.sale_date, 'YYYYMMDD') || '-' || lpad(slots.n::text, 3, '0') as order_number,
       greatest(d.sale_date::timestamp at time zone 'Asia/Manila',
         least((d.sale_date + time '09:00' + make_interval(mins => mod(slots.n * 43 + d.day_index * 17, 660)))
               at time zone 'Asia/Manila', d.run_at)) as created_at
from days d cross join lateral generate_series(1,
  8 + d.day_index / 60 + mod(d.day_index * 7, 9)
    + case when extract(isodow from d.sale_date) in (6, 7) then 5 else 0 end
    + case when extract(month from d.sale_date) in (11, 12) then 3 else 0 end
) slots(n);

create temporary table _dayo_demo_new_orders on commit drop as
with inserted as (
  insert into public.orders (
    order_number, customer_name, source, payment_status, payment_method,
    payment_reference_number, order_type, status, notes, created_at, updated_at
  )
  select p.order_number, 'Demo Customer ' || lpad((1 + mod(p.day_index * 13 + p.slot, 120))::text, 3, '0'),
         case when mod(p.slot, 3) = 0 then 'Manual POS' else 'QR Order' end,
         'Paid',
         (case when mod(p.slot, 4) = 0 then 'GCash' else 'Cash' end)::public.payment_method,
         case when mod(p.slot, 4) = 0 then 'DEMO-' || p.order_number end,
         (case when mod(p.slot, 5) = 0 then 'Take Out' else 'Dine In' end)::public.order_type,
         'Pending'::public.order_status, c.marker, p.created_at, p.created_at
  from _dayo_demo_plan p cross join _dayo_demo_config c
  order by p.sale_date, p.slot
  on conflict (order_number) do nothing
  returning id, order_number
)
select i.id, p.* from inserted i join _dayo_demo_plan p using (order_number);

-- Pick 1-3 lines per order from the weighted menu pool; stable hashing makes
-- fast/slow demand reproducible without assigning equal sales to every item.
insert into public.order_items (
  order_id, menu_item_id, item_name, selected_variant_key,
  variant_label, unit_price, quantity
)
select o.id, m.id, m.name, v.option->>'key', v.option->>'label',
       (v.option->>'price')::numeric,
       1 + mod(o.day_index + o.slot + lines.n, 3)
from _dayo_demo_new_orders o
cross join lateral generate_series(1, 1 + mod(o.slot, 3)) lines(n)
join _dayo_demo_pool pool on pool.ticket = 1 + mod(
  ('x' || substr(md5(o.order_number || ':' || lines.n), 1, 7))::bit(28)::integer,
  (select count(*)::integer from _dayo_demo_pool)
)
join _dayo_demo_menu m on m.id = pool.id
cross join lateral (
  select m.options->mod(o.day_index + o.slot + lines.n, jsonb_array_length(m.options)) as option
) v;

-- Import historical orders as already accounted for in inventory. The normal
-- completion trigger recognizes these claims; current stock is never consumed.
-- Keep the claims even on local-sync versions that bypass completion deductions.
insert into public.order_inventory_deductions (order_id, deducted_at)
select id::text, created_at from _dayo_demo_new_orders
on conflict (order_id) do nothing;

update public.orders o set status = 'Completed', updated_at = n.created_at
from _dayo_demo_new_orders n where o.id = n.id;

-- Only zero quantities may increase. Archived/expired ingredients need separate
-- approval to restore/renew, so this script leaves their entire rows untouched.
-- Stock amounts and costs below are illustrative values in each stored unit.
create temporary table _dayo_demo_stock_changes on commit drop as
with eligible as (
  select i.id, i.name, i.unit, i.current_stock as old_stock, i.unit_cost as old_cost,
         case lower(btrim(i.unit))
           when 'pcs' then 60 when 'pc' then 60 when 'piece' then 60 when 'pieces' then 60
           when 'grams' then 5000 when 'gram' then 5000 when 'g' then 5000
           when 'ml' then 5000 when 'milliliter' then 5000 when 'milliliters' then 5000
           when 'millilitre' then 5000 when 'millilitres' then 5000
           when 'kg' then 5 when 'kilogram' then 5 when 'kilograms' then 5
           when 'l' then 5 when 'liter' then 5 when 'liters' then 5
           when 'litre' then 5 when 'litres' then 5
         end::numeric as sample_stock,
         case lower(btrim(i.unit))
           when 'pcs' then 8 when 'pc' then 8 when 'piece' then 8 when 'pieces' then 8
           when 'grams' then 0.12 when 'gram' then 0.12 when 'g' then 0.12
           when 'ml' then 0.06 when 'milliliter' then 0.06 when 'milliliters' then 0.06
           when 'millilitre' then 0.06 when 'millilitres' then 0.06
           when 'kg' then 120 when 'kilogram' then 120 when 'kilograms' then 120
           when 'l' then 60 when 'liter' then 60 when 'liters' then 60
           when 'litre' then 60 when 'litres' then 60
         end::numeric as sample_cost
  from public.ingredients i cross join _dayo_demo_config c
  where to_jsonb(i)->>'archived_at' is null
    and (i.expires_on is null or i.expires_on > (c.run_at at time zone 'Asia/Manila')::date)
    and (i.current_stock = 0 or i.unit_cost is null or i.unit_cost = 0)
  for update of i
), changed as (
  update public.ingredients i
  set current_stock = case when e.old_stock = 0
        then greatest(e.sample_stock, i.reorder_level * 2,
          coalesce((select max(r.quantity) * 100 from public.menu_item_ingredients r where r.ingredient_id = i.id), 0))
        else i.current_stock end,
      unit_cost = case when e.old_cost is null or e.old_cost = 0 then e.sample_cost else i.unit_cost end
  from eligible e where i.id = e.id and e.sample_stock is not null
  returning i.id, i.name, i.unit, e.old_stock, i.current_stock as new_stock,
            e.old_cost, i.unit_cost as new_cost
)
select * from changed;

-- One auditable positive movement for each quantity actually filled.
insert into public.stock_movements (ingredient_id, adjustment, reason)
select id, new_stock - old_stock, '[DAYO DEMO YEAR V1] Sample refill of zero stock'
from _dayo_demo_stock_changes where new_stock > old_stock;

notify pgrst, 'reload schema';

-- Results: monthly chart coverage, exact inventory edits, skipped rows, summary.
select to_char(p.sale_date, 'YYYY-MM') as month,
       count(distinct o.id) as demo_orders, count(distinct p.sale_date) as days_with_sales,
       sum(oi.subtotal) as demo_revenue
from _dayo_demo_plan p join public.orders o using (order_number)
join public.order_items oi on oi.order_id = o.id
group by 1 order by 1;

select * from _dayo_demo_stock_changes order by name;

select i.id, i.name, i.unit, i.current_stock, i.unit_cost, i.expires_on,
       case when to_jsonb(i)->>'archived_at' is not null then 'Archived: restoration needs approval'
            when i.expires_on <= (c.run_at at time zone 'Asia/Manila')::date then 'Expired: renewal/replacement needs approval'
            else 'Unknown unit: explicit conversion needed' end as skipped_reason
from public.ingredients i cross join _dayo_demo_config c
where (i.current_stock = 0 or i.unit_cost is null or i.unit_cost = 0)
  and not exists (select 1 from _dayo_demo_stock_changes s where s.id = i.id)
order by i.name;

select c.start_date, c.end_date,
       (select count(*) from _dayo_demo_new_orders) as new_demo_orders,
       count(distinct o.id) as total_demo_orders,
       count(distinct p.sale_date) as days_with_sales,
       sum(oi.subtotal) as demo_revenue,
       (select count(*) from _dayo_demo_stock_changes where new_stock > old_stock) as zero_quantities_filled,
       (select count(*) from _dayo_demo_stock_changes where new_cost is distinct from old_cost) as sample_costs_filled
from _dayo_demo_config c join _dayo_demo_plan p on true
join public.orders o using (order_number)
join public.order_items oi on oi.order_id = o.id
group by c.start_date, c.end_date;

commit;
