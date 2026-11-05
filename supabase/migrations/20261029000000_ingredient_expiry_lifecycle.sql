-- Retain recipe/history references while removing expired stock from active inventory.
alter table public.ingredients add column if not exists archived_at timestamptz;
alter table public.ingredient_archives add column if not exists archive_reason text not null default 'deleted'
  check (archive_reason in ('deleted', 'expired'));
create index if not exists ingredients_expiry_pending_idx on public.ingredients(expires_on)
  where archived_at is null and expires_on is not null;

create or replace function public.archive_ingredient_before_expiry_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  today date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  snapshot jsonb;
begin
  -- Source archive snapshots and stock movements are mirrored separately.
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is not null then
    if new.expires_on > today then
      new.archived_at := null;
    elsif new.current_stock <> 0 then
      raise exception 'Set a future expiry date before restocking an archived ingredient.';
    else
      new.archived_at := old.archived_at;
    end if;
  end if;
  if new.archived_at is null and new.expires_on <= today then
    snapshot := to_jsonb(new);
    new.archived_at := clock_timestamp();
    insert into public.ingredient_archives(ingredient_id, ingredient_data, archived_at, archived_by, archive_reason)
      values(new.id, snapshot, new.archived_at, auth.uid(), 'expired');
    new.current_stock := 0;
  end if;
  if new.archived_at is not null then new.current_stock := 0; end if;
  return new;
end;
$$;
revoke all on function public.archive_ingredient_before_expiry_write() from public, anon, authenticated, service_role;

create or replace function public.record_expired_ingredient_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
declare discarded numeric;
begin
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then return new; end if;
  if new.archived_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is not null then return new; end if;
  select (ingredient_data->>'current_stock')::numeric into discarded
    from public.ingredient_archives
    where ingredient_id = new.id and archive_reason = 'expired' and archived_at = new.archived_at limit 1;
  if discarded > 0 then
    insert into public.stock_movements(ingredient_id, adjustment, reason, created_by)
      values(new.id, -discarded, 'Expired ingredient archived', auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.record_expired_ingredient_stock() from public, anon, authenticated, service_role;

drop trigger if exists archive_ingredient_before_expiry_write on public.ingredients;
create trigger archive_ingredient_before_expiry_write before insert or update on public.ingredients
  for each row execute function public.archive_ingredient_before_expiry_write();
drop trigger if exists record_expired_ingredient_stock on public.ingredients;
create trigger record_expired_ingredient_stock after insert or update on public.ingredients
  for each row execute function public.record_expired_ingredient_stock();

create or replace function public.archive_expired_ingredients()
returns setof bigint language plpgsql security invoker set search_path = '' as $$
declare target record;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
    and not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]), false) then
    raise exception 'Only authorized Super Admins can archive expired ingredients.' using errcode = '42501';
  end if;
  for target in
    select id from public.ingredients
    where archived_at is null and expires_on <= (clock_timestamp() at time zone 'Asia/Manila')::date
    order by id for update skip locked
  loop
    -- The triggers save the snapshot, zero stock and record the discarded amount atomically.
    update public.ingredients set current_stock = current_stock, updated_at = clock_timestamp() where id = target.id;
    return next target.id;
  end loop;
end;
$$;
revoke all on function public.archive_expired_ingredients() from public, anon, authenticated, service_role;
grant execute on function public.archive_expired_ingredients() to authenticated, service_role;

-- Refuse expired stock even in the interval before the scheduled sweep.
create or replace function public.deduct_order_ingredients_on_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_claimed_order_id text; v_requirement record; v_updated_count integer;
begin
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then
    return new;
  end if;
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
