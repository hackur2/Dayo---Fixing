-- LOCAL SQL EDITOR: add only ingredient_archives and suppliers.
-- Existing business rows and the local sync queue are verified unchanged.
-- Supplier fields follow Dayo's application code; full cloud DDL was unavailable.
-- This does not apply the unrelated expiry/unit/cost/sync upgrades or demo seed.
-- Only the two migrations included below are recorded as applied.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(8122, 103027);
create temporary table _dayo_missing_table_checks (
  schema_name text, table_name text, fingerprint text
) on commit drop;
do $$
declare v_table record; v_fingerprint text;
begin
  for v_table in
    select table_schema, table_name from information_schema.tables
    where table_type = 'BASE TABLE' and
      (table_schema = 'public' or (table_schema = 'local_sync' and table_name = 'outbox'))
    order by table_schema, table_name
  loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from %I.%I t',
      '[]', v_table.table_schema, v_table.table_name) into v_fingerprint;
    insert into _dayo_missing_table_checks values(v_table.table_schema, v_table.table_name, v_fingerprint);
  end loop;
end;
$$;

-- Migration 20261028000000: ingredient_archive
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

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261028000000','ingredient_archive',array['-- Preserve successful ingredient deletions in the same transaction.
create table if not exists public.ingredient_archives (
  id uuid primary key default gen_random_uuid(),
  ingredient_id bigint not null,
  ingredient_data jsonb not null check (jsonb_typeof(ingredient_data) = ''object''),
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
  using (public.has_app_role(array[''SUPER_ADMIN'']::public.app_role[]));

create or replace function public.preserve_deleted_ingredient()
returns trigger
language plpgsql
security definer
set search_path = ''''
as $$
begin
  -- The local archive row is mirrored separately; do not create a second copy.
  if auth.role() = ''service_role'' and current_setting(''app.sync_source'', true) = ''cloud_mirror'' then
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
set search_path = ''''
as $$
declare
  deleted_id bigint;
begin
  if not public.has_app_role(array[''SUPER_ADMIN'']::public.app_role[]) then
    raise exception ''Only authorized Super Admins can archive ingredients.'' using errcode = ''42501'';
  end if;
  select id into deleted_id from public.ingredients where id = p_ingredient_id for update;
  if not found then raise exception ''Ingredient not found or no longer available.''; end if;
  if exists (select 1 from public.menu_item_ingredients where ingredient_id = p_ingredient_id) then
    raise exception ''This ingredient is used in a menu recipe. Remove it from the recipe before deleting it.'';
  end if;
  if exists (select 1 from public.stock_movements where ingredient_id = p_ingredient_id) then
    raise exception ''This ingredient has stock movement history and cannot be deleted.'';
  end if;
  delete from public.ingredients where id = p_ingredient_id returning id into deleted_id;
  if not found then raise exception ''Ingredient was not archived. Check your account permissions and try again.''; end if;
  return deleted_id;
end;
$$;

revoke all on function public.delete_ingredient_to_archive(bigint) from public, anon, authenticated, service_role;
grant execute on function public.delete_ingredient_to_archive(bigint) to authenticated;

-- Existing local-first installations get the outbox trigger immediately.
do $$
begin
  if to_regprocedure(''local_sync.capture_change()'') is not null then
    execute ''drop trigger if exists local_sync_capture_change on public.ingredient_archives'';
    execute ''create trigger local_sync_capture_change after insert or update or delete on public.ingredient_archives for each row execute function local_sync.capture_change()'';
  end if;
end;
$$;

notify pgrst, ''reload schema'';
'])
on conflict(version) do nothing;


-- Migration 20261030000004: suppliers
-- Supplier directory schema used by src/services/supplierService.js.
-- This captures the application's required fields; the cloud's complete DDL
-- has not been independently verified. Existing records are never seeded/reset.
create table if not exists public.suppliers (
  id bigint generated by default as identity primary key,
  name text not null check (length(btrim(name)) > 0),
  product_type text not null check (length(btrim(product_type)) > 0),
  product_name text not null default '',
  mobile text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
revoke all on table public.suppliers from public, anon, authenticated;
grant select, insert, update, delete on table public.suppliers to authenticated;
grant all on table public.suppliers to service_role;

-- The directory is a Super Admin inventory feature, using the same role check
-- as ingredient management. Authenticated ordinary staff have no row access.
drop policy if exists "Super admins manage suppliers" on public.suppliers;
create policy "Super admins manage suppliers" on public.suppliers
  for all to authenticated
  using (public.has_app_role(array['SUPER_ADMIN']::public.app_role[]))
  with check (public.has_app_role(array['SUPER_ADMIN']::public.app_role[]));

-- Resolve the actual identity sequence, including when this setup is repeated.
do $$
declare v_sequence text;
begin
  v_sequence := pg_get_serial_sequence('public.suppliers', 'id');
  if v_sequence is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', v_sequence);
    execute format('grant usage, select on sequence %s to authenticated', v_sequence);
    execute format('grant all on sequence %s to service_role', v_sequence);
  end if;
end;
$$;

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

-- The upgraded sync receiver supports suppliers; the installed legacy receiver
-- does not. Do not enqueue supplier changes for an incompatible legacy worker.
-- cloud_sync_local_setup.sql also installs this trigger during a later upgrade.
do $$
begin
  if to_regprocedure('local_sync.capture_change()') is not null
    and to_regprocedure('local_sync.queue_record(text,text,jsonb,bigint)') is not null
    and to_regprocedure('cloud_sync.allowed_table(text)') is not null then
    if cloud_sync.allowed_table('suppliers') then
      execute 'drop trigger if exists local_sync_capture_change on public.suppliers';
      execute 'create trigger local_sync_capture_change after insert or update or delete on public.suppliers for each row execute function local_sync.capture_change()';
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261030000004','suppliers',array['-- Supplier directory schema used by src/services/supplierService.js.
-- This captures the application''s required fields; the cloud''s complete DDL
-- has not been independently verified. Existing records are never seeded/reset.
create table if not exists public.suppliers (
  id bigint generated by default as identity primary key,
  name text not null check (length(btrim(name)) > 0),
  product_type text not null check (length(btrim(product_type)) > 0),
  product_name text not null default '''',
  mobile text not null default '''',
  address text not null default '''',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
revoke all on table public.suppliers from public, anon, authenticated;
grant select, insert, update, delete on table public.suppliers to authenticated;
grant all on table public.suppliers to service_role;

-- The directory is a Super Admin inventory feature, using the same role check
-- as ingredient management. Authenticated ordinary staff have no row access.
drop policy if exists "Super admins manage suppliers" on public.suppliers;
create policy "Super admins manage suppliers" on public.suppliers
  for all to authenticated
  using (public.has_app_role(array[''SUPER_ADMIN'']::public.app_role[]))
  with check (public.has_app_role(array[''SUPER_ADMIN'']::public.app_role[]));

-- Resolve the actual identity sequence, including when this setup is repeated.
do $$
declare v_sequence text;
begin
  v_sequence := pg_get_serial_sequence(''public.suppliers'', ''id'');
  if v_sequence is not null then
    execute format(''revoke all on sequence %s from public, anon, authenticated'', v_sequence);
    execute format(''grant usage, select on sequence %s to authenticated'', v_sequence);
    execute format(''grant all on sequence %s to service_role'', v_sequence);
  end if;
end;
$$;

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

-- The upgraded sync receiver supports suppliers; the installed legacy receiver
-- does not. Do not enqueue supplier changes for an incompatible legacy worker.
-- cloud_sync_local_setup.sql also installs this trigger during a later upgrade.
do $$
begin
  if to_regprocedure(''local_sync.capture_change()'') is not null
    and to_regprocedure(''local_sync.queue_record(text,text,jsonb,bigint)'') is not null
    and to_regprocedure(''cloud_sync.allowed_table(text)'') is not null then
    if cloud_sync.allowed_table(''suppliers'') then
      execute ''drop trigger if exists local_sync_capture_change on public.suppliers'';
      execute ''create trigger local_sync_capture_change after insert or update or delete on public.suppliers for each row execute function local_sync.capture_change()'';
    end if;
  end if;
end;
$$;

notify pgrst, ''reload schema'';
'])
on conflict(version) do nothing;

-- Refuse to commit if any pre-existing table rows or queue entries changed.
do $$
declare v_before record; v_after text;
begin
  for v_before in select * from _dayo_missing_table_checks loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from %I.%I t',
      '[]', v_before.schema_name, v_before.table_name) into v_after;
    if v_before.fingerprint is distinct from v_after then
      raise exception 'Existing rows changed in %.%; migration rolled back.', v_before.schema_name, v_before.table_name;
    end if;
  end loop;
end;
$$;
select table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE' order by table_name;
select version,name from supabase_migrations.schema_migrations
where version in ('20261028000000','20261030000004') order by version;
commit;
