-- Apply incoming local changes on the cloud mirror without re-running
-- application-side stock deduction and availability triggers.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.sync_source', true) = 'cloud_mirror' then
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_menu_availability_from_ingredient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare linked_item record;
begin
  if current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  for linked_item in
    select menu_item_id from public.menu_item_ingredients where ingredient_id = coalesce(new.id, old.id)
  loop
    perform public.refresh_menu_item_availability(linked_item.menu_item_id);
  end loop;
  return coalesce(new, old);
end;
$$;

create or replace function public.sync_menu_availability_from_menu_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  perform public.refresh_menu_item_availability(new.id);
  return new;
end;
$$;

create or replace function public.sync_menu_availability_from_recipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.sync_source', true) = 'cloud_mirror' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op <> 'INSERT' then perform public.refresh_menu_item_availability(old.menu_item_id); end if;
  if tg_op <> 'DELETE' then perform public.refresh_menu_item_availability(new.menu_item_id); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.deduct_order_ingredients_on_completion()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_claimed_order_id text;
  v_requirement record;
  v_updated_count integer;
begin
  if current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  if new.status <> 'Completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'Completed' then return new; end if;

  insert into public.order_inventory_deductions (order_id)
  values (new.id::text)
  on conflict (order_id) do nothing
  returning order_id into v_claimed_order_id;
  if v_claimed_order_id is null then return new; end if;

  for v_requirement in
    select recipe.ingredient_id,
           sum(recipe.quantity * ordered_item.quantity)::numeric as quantity
    from public.order_items as ordered_item
    join public.menu_item_ingredients as recipe on recipe.menu_item_id = ordered_item.menu_item_id
    where ordered_item.order_id = new.id
    group by recipe.ingredient_id
    order by recipe.ingredient_id
  loop
    update public.ingredients
    set current_stock = current_stock - v_requirement.quantity
    where id = v_requirement.ingredient_id and current_stock >= v_requirement.quantity;
    get diagnostics v_updated_count = row_count;
    if v_updated_count = 0 then
      raise exception 'Insufficient stock for ingredient %. Order % was not completed.',
        v_requirement.ingredient_id, new.order_number using errcode = '23514';
    end if;
    insert into public.stock_movements (ingredient_id, adjustment, reason)
    values (v_requirement.ingredient_id, -v_requirement.quantity, 'Order ' || new.order_number || ' completed');
  end loop;
  return new;
end;
$$;

create or replace function public.apply_local_sync_event(
  p_table_name text,
  p_operation text,
  p_row jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_table regclass;
  primary_columns text;
  all_columns text;
  selected_columns text;
  update_columns text;
  match_condition text;
  row_data jsonb := p_row;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Local sync requires the service role' using errcode = '42501';
  end if;

  if p_table_name not in (
    'combo_components', 'feedback', 'ingredients', 'menu_categories',
    'menu_item_ingredients', 'menu_item_variant_sets', 'menu_item_variants',
    'menu_items', 'menu_variant_options', 'menu_variant_sets',
    'order_inventory_deductions', 'order_items', 'orders', 'promotions',
    'staff', 'staff_shifts', 'stock_movements'
  ) then
    raise exception 'Table is not allowed for local sync: %', p_table_name using errcode = '22023';
  end if;
  if p_operation not in ('INSERT', 'UPDATE', 'DELETE') then
    raise exception 'Unsupported sync operation: %', p_operation using errcode = '22023';
  end if;

  if p_table_name = 'orders' then row_data := row_data || jsonb_build_object('created_by', null); end if;
  if p_table_name = 'stock_movements' then row_data := row_data || jsonb_build_object('created_by', null); end if;
  if p_table_name = 'feedback' then row_data := row_data || jsonb_build_object('reviewed_by', null); end if;
  if p_table_name = 'staff' then row_data := row_data || jsonb_build_object('auth_user_id', null); end if;

  target_table := to_regclass(format('public.%I', p_table_name));
  if target_table is null then raise exception 'Sync table does not exist: %', p_table_name; end if;

  select string_agg(format('%I', a.attname), ', ' order by key.ordinality),
         string_agg(format('target.%I is not distinct from source.%I', a.attname, a.attname), ' and ' order by key.ordinality)
  into primary_columns, match_condition
  from pg_index i
  cross join lateral unnest(i.indkey) with ordinality as key(attnum, ordinality)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = key.attnum
  where i.indrelid = target_table and i.indisprimary;
  if primary_columns is null then raise exception 'Sync table has no primary key: %', p_table_name; end if;

  if p_operation = 'DELETE' then
    execute format(
      'delete from public.%I as target using jsonb_populate_record(null::public.%I, $1) as source where %s',
      p_table_name, p_table_name, match_condition
    ) using row_data;
    return;
  end if;

  select string_agg(format('%I', attname), ', ' order by attnum),
         string_agg(format('source.%I', attname), ', ' order by attnum),
         string_agg(format('%I = excluded.%I', attname, attname), ', ' order by attnum)
  into all_columns, selected_columns, update_columns
  from pg_attribute
  where attrelid = target_table and attnum > 0 and not attisdropped and attgenerated = '';

  -- Build update assignments only for non-key columns.
  select string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ' order by a.attnum)
  into update_columns
  from pg_attribute a
  where a.attrelid = target_table and a.attnum > 0 and not a.attisdropped
    and a.attgenerated = ''
    and position(',' || format('%I', a.attname) || ',' in ',' || primary_columns || ',') = 0;

  perform set_config('app.sync_source', 'cloud_mirror', true);
  if update_columns is null then
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as source on conflict (%s) do nothing',
      p_table_name, all_columns, selected_columns, p_table_name, primary_columns
    ) using row_data;
  else
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) as source on conflict (%s) do update set %s',
      p_table_name, all_columns, selected_columns, p_table_name, primary_columns, update_columns
    ) using row_data;
  end if;
end;
$$;

revoke all on function public.apply_local_sync_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_local_sync_event(text, text, jsonb) to service_role;
