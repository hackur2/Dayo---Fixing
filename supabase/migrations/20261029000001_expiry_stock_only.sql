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
