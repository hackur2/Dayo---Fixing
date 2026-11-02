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
