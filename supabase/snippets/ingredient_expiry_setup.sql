-- Run this whole file in Supabase SQL Editor on the primary and mirror (if used).
-- Restores automatic expiry archives to Inventory with zero stock; manual deletions stay archived.
-- Existing expiry cron jobs remain compatible and now only clear stock.
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

-- Expiry clears stock but never archives the ingredient catalogue record.
alter table public.ingredients add column if not exists archived_at timestamptz;
alter table public.ingredients add column if not exists expiry_discarded_stock numeric not null default 0 check (expiry_discarded_stock >= 0);
alter table public.ingredients add column if not exists stock_expired_at timestamptz;
alter table public.ingredient_archives add column if not exists archive_reason text not null default 'deleted';
alter table public.ingredient_archives add column if not exists restored_at timestamptz;

drop trigger if exists archive_ingredient_before_expiry_write on public.ingredients;
drop trigger if exists record_expired_ingredient_stock on public.ingredients;

create or replace function public.zero_expired_ingredient_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  if new.expires_on <= (clock_timestamp() at time zone 'Asia/Manila')::date and new.current_stock > 0 then
    new.expiry_discarded_stock := new.current_stock;
    new.stock_expired_at := clock_timestamp();
    new.current_stock := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.zero_expired_ingredient_before_write() from public, anon, authenticated, service_role;

create or replace function public.record_expired_ingredient_loss()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  if new.stock_expired_at is null then return new; end if;
  if new.current_stock <> 0 or new.expires_on is null or new.expires_on > (clock_timestamp() at time zone 'Asia/Manila')::date then return new; end if;
  if tg_op = 'UPDATE' and new.stock_expired_at is not distinct from old.stock_expired_at then return new; end if;
  if new.expiry_discarded_stock > 0 then
    insert into public.stock_movements(ingredient_id, adjustment, reason, created_by)
      values(new.id, -new.expiry_discarded_stock, 'Expired ingredient stock cleared', auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.record_expired_ingredient_loss() from public, anon, authenticated, service_role;

drop trigger if exists zero_expired_ingredient_before_write on public.ingredients;
create trigger zero_expired_ingredient_before_write before insert or update on public.ingredients
  for each row execute function public.zero_expired_ingredient_before_write();
drop trigger if exists record_expired_ingredient_loss on public.ingredients;
create trigger record_expired_ingredient_loss after insert or update on public.ingredients
  for each row execute function public.record_expired_ingredient_loss();

create or replace function public.zero_expired_ingredient_stock()
returns setof bigint language plpgsql security invoker set search_path = '' as $$
declare target record;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]), false) then
    raise exception 'Only authorized Super Admins can clear expired ingredient stock.' using errcode = '42501';
  end if;
  for target in
    select id from public.ingredients where archived_at is null and current_stock > 0
      and expires_on <= (clock_timestamp() at time zone 'Asia/Manila')::date
    order by id for update skip locked
  loop
    update public.ingredients set current_stock = current_stock, updated_at = clock_timestamp() where id = target.id;
    return next target.id;
  end loop;
end;
$$;
revoke all on function public.zero_expired_ingredient_stock() from public, anon, authenticated, service_role;
grant execute on function public.zero_expired_ingredient_stock() to authenticated, service_role;

-- Existing app versions and the earlier cron job remain safe during rollout.
create or replace function public.archive_expired_ingredients()
returns setof bigint language sql security invoker set search_path = '' as $$
  select public.zero_expired_ingredient_stock();
$$;
revoke all on function public.archive_expired_ingredients() from public, anon, authenticated, service_role;
grant execute on function public.archive_expired_ingredients() to authenticated, service_role;

-- Restore only catalogue rows archived by the earlier automatic expiry process.
-- Never recreate a manually deleted ingredient or refill discarded stock.
update public.ingredients i set archived_at = null, current_stock = 0, updated_at = clock_timestamp()
where i.archived_at is not null and exists (
  select 1 from public.ingredient_archives a where a.ingredient_id = i.id
    and a.archive_reason = 'expired' and a.archived_at = i.archived_at and a.restored_at is null
);
update public.ingredient_archives a set restored_at = clock_timestamp()
where a.archive_reason = 'expired' and a.restored_at is null
  and exists (select 1 from public.ingredients i where i.id = a.ingredient_id and i.archived_at is null);

-- Block completed orders from consuming expired stock before the next sweep.
create or replace function public.deduct_order_ingredients_on_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claimed_order_id text; v_requirement record; v_updated_count integer;
begin
  if new.status <> 'Completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'Completed' then return new; end if;
  insert into public.order_inventory_deductions(order_id) values(new.id::text)
    on conflict(order_id) do nothing returning order_id into v_claimed_order_id;
  if v_claimed_order_id is null then return new; end if;
  for v_requirement in
    select recipe.ingredient_id, sum(recipe.quantity * ordered_item.quantity)::numeric as quantity
    from public.order_items ordered_item join public.menu_item_ingredients recipe on recipe.menu_item_id = ordered_item.menu_item_id
    where ordered_item.order_id = new.id group by recipe.ingredient_id order by recipe.ingredient_id
  loop
    update public.ingredients set current_stock = current_stock - v_requirement.quantity
      where id = v_requirement.ingredient_id and current_stock >= v_requirement.quantity and archived_at is null
        and (expires_on is null or expires_on > (clock_timestamp() at time zone 'Asia/Manila')::date);
    get diagnostics v_updated_count = row_count;
    if v_updated_count = 0 then
      raise exception 'Insufficient or expired stock for ingredient %. Order % was not completed.', v_requirement.ingredient_id, new.order_number using errcode = '23514';
    end if;
    insert into public.stock_movements(ingredient_id, adjustment, reason)
      values(v_requirement.ingredient_id, -v_requirement.quantity, 'Order ' || new.order_number || ' completed');
  end loop;
  return new;
end;
$$;
revoke all on function public.deduct_order_ingredients_on_completion() from public, anon, authenticated, service_role;
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

