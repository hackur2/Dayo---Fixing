-- ADS uses completed-order ingredient deductions in the preceding 30 x 24 hours.
-- Shared lead time = 1 day. Buffer = 1 day. ROP = (quantity / 30) * 2.
-- ROP rounds upward to the existing numeric(12,3) stock precision.
create index if not exists stock_movements_reorder_history_idx
  on public.stock_movements(ingredient_id, created_at)
  where adjustment < 0 and reason ~* '^Order .+ completed$';

create or replace function public.recalculate_ingredient_reorder_points(
  p_as_of timestamptz default clock_timestamp(), p_ingredient_id bigint default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_updated integer;
begin
  if p_as_of is null then raise exception 'An as-of timestamp is required'; end if;
  -- Serialize with stock edits and completion deductions before reading the ledger.
  perform id from public.ingredients
    where archived_at is null and (p_ingredient_id is null or id = p_ingredient_id)
    order by id for update;
  with consumption as (
    select ingredient_id, sum(-adjustment) as quantity
    from public.stock_movements
    where adjustment < 0 and reason ~* '^Order .+ completed$'
      and created_at >= p_as_of - interval '720 hours' and created_at <= p_as_of
      and (p_ingredient_id is null or ingredient_id = p_ingredient_id)
    group by ingredient_id
  ), calculated as (
    select i.id, ceil((coalesce(c.quantity, 0) / 30 * (1 + 1)) * 1000) / 1000 as rop
    from public.ingredients i left join consumption c on c.ingredient_id = i.id
    where i.archived_at is null and (p_ingredient_id is null or i.id = p_ingredient_id)
  )
  update public.ingredients i set reorder_level = c.rop
  from calculated c where i.id = c.id and i.reorder_level is distinct from c.rop;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
revoke all on function public.recalculate_ingredient_reorder_points(timestamptz,bigint) from public,anon,authenticated,service_role;

create or replace function public.refresh_ingredient_reorder_points()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.has_app_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]), false)
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'An authorized staff account is required' using errcode = '42501';
  end if;
  -- The primary sends its calculated ingredient row through the existing outbox.
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then return 0; end if;
  return public.recalculate_ingredient_reorder_points(clock_timestamp());
end;
$$;
revoke all on function public.refresh_ingredient_reorder_points() from public,anon;
grant execute on function public.refresh_ingredient_reorder_points() to authenticated,service_role;

create or replace function public.refresh_reorder_point_from_stock_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if auth.role() = 'service_role' and current_setting('app.sync_source', true) = 'cloud_mirror' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.recalculate_ingredient_reorder_points(clock_timestamp(), new.ingredient_id);
  elsif tg_op = 'DELETE' then
    perform public.recalculate_ingredient_reorder_points(clock_timestamp(), old.ingredient_id);
  else
    for v_id in select distinct id from unnest(array[old.ingredient_id,new.ingredient_id]) as ids(id) order by id loop
      perform public.recalculate_ingredient_reorder_points(clock_timestamp(), v_id);
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.refresh_reorder_point_from_stock_movement() from public,anon,authenticated,service_role;
drop trigger if exists refresh_reorder_point_from_stock_movement on public.stock_movements;
create trigger refresh_reorder_point_from_stock_movement after insert or update or delete on public.stock_movements
  for each row execute function public.refresh_reorder_point_from_stock_movement();

select public.recalculate_ingredient_reorder_points(clock_timestamp());
notify pgrst, 'reload schema';
