-- Mirror archived ingredient snapshots alongside ingredient removals.
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
    'combo_components', 'feedback', 'ingredients', 'ingredient_archives', 'menu_categories',
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

  if p_table_name = 'ingredient_archives' then row_data := row_data || jsonb_build_object('archived_by', null); end if;
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

  perform set_config('app.sync_source', 'cloud_mirror', true);
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
