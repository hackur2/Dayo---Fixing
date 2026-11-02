-- Run this whole file in the Supabase SQL Editor, then refresh the app.
-- Re-running setup preserves existing archive records.
begin;

-- Preserve successful ingredient deletions in the same transaction.
create table if not exists public.ingredient_archives (
  id uuid primary key default gen_random_uuid(),
  ingredient_id bigint not null,
  ingredient_data jsonb not null check (jsonb_typeof(ingredient_data) = 'object'),
  archived_at timestamptz not null default now(),
  archived_by uuid
);

create index if not exists ingredient_archives_archived_at_idx on public.ingredient_archives (archived_at desc, id);
alter table public.ingredient_archives enable row level security;
revoke all on table public.ingredient_archives from public, anon, authenticated;
grant select on table public.ingredient_archives to authenticated;
grant all on table public.ingredient_archives to service_role;

drop policy if exists "Super admins read ingredient archives" on public.ingredient_archives;
create policy "Super admins read ingredient archives" on public.ingredient_archives
  for select to authenticated
  using (public.has_app_role(array['SUPER_ADMIN']::public.app_role[]));

create or replace function public.preserve_deleted_ingredient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The local archive row is mirrored separately; do not create a second copy.
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then
    return old;
  end if;
  insert into public.ingredient_archives (ingredient_id, ingredient_data, archived_by)
  values (old.id, to_jsonb(old), auth.uid());
  return old;
end;
$$;

revoke all on function public.preserve_deleted_ingredient() from public, anon, authenticated, service_role;
drop trigger if exists preserve_deleted_ingredient on public.ingredients;
create trigger preserve_deleted_ingredient
  before delete on public.ingredients
  for each row execute function public.preserve_deleted_ingredient();

-- The client uses this RPC, so a missing archive migration cannot fall back to
-- a permanent delete. Existing recipe and stock-history protections remain.
create or replace function public.delete_ingredient_to_archive(p_ingredient_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_id bigint;
begin
  if not public.has_app_role(array['SUPER_ADMIN']::public.app_role[]) then
    raise exception 'Only authorized Super Admins can archive ingredients.' using errcode = '42501';
  end if;
  select id into deleted_id from public.ingredients where id = p_ingredient_id for update;
  if not found then raise exception 'Ingredient not found or no longer available.'; end if;
  if exists (select 1 from public.menu_item_ingredients where ingredient_id = p_ingredient_id) then
    raise exception 'This ingredient is used in a menu recipe. Remove it from the recipe before deleting it.';
  end if;
  if exists (select 1 from public.stock_movements where ingredient_id = p_ingredient_id) then
    raise exception 'This ingredient has stock movement history and cannot be deleted.';
  end if;
  delete from public.ingredients where id = p_ingredient_id returning id into deleted_id;
  if not found then raise exception 'Ingredient was not archived. Check your account permissions and try again.'; end if;
  return deleted_id;
end;
$$;

revoke all on function public.delete_ingredient_to_archive(bigint) from public, anon, authenticated, service_role;
grant execute on function public.delete_ingredient_to_archive(bigint) to authenticated;

-- Existing local-first installations get the outbox trigger immediately.
do $$
begin
  if to_regprocedure('local_sync.capture_change()') is not null then
    execute 'drop trigger if exists local_sync_capture_change on public.ingredient_archives';
    execute 'create trigger local_sync_capture_change after insert or update or delete on public.ingredient_archives for each row execute function local_sync.capture_change()';
  end if;
end;
$$;

notify pgrst, 'reload schema';

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

commit;
