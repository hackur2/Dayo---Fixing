-- One base unit per ingredient, used by stock, recipes, ledger history and ROP.
-- Convert known legacy units atomically; never infer pack sizes or densities.
begin;
lock table public.ingredients, public.menu_item_ingredients, public.stock_movements in share row exclusive mode;

do $$
declare v_unknown text;
begin
  select string_agg(id::text || ': ' || coalesce(unit, '<missing>'), ', ' order by id)
  into v_unknown from public.ingredients
  where unit is null or lower(btrim(unit)) not in (
    'pc','pcs','piece','pieces','g','gram','grams',
    'ml','milliliter','milliliters','millilitre','millilitres',
    'kg','kilogram','kilograms','l','liter','liters','litre','litres'
  );
  if v_unknown is not null then
    raise exception 'Ingredient units need explicit quantity conversion before setup: %', v_unknown;
  end if;
end;
$$;

-- Preserve a cost such as 0.0001 per kg as 0.0000001 per gram.
alter table public.ingredients alter column unit_cost type numeric(18,7);

do $$
declare v_row record; v_unit text; v_factor numeric; v_reorder_mode "char";
begin
  select tgenabled into v_reorder_mode from pg_trigger
    where tgrelid = 'public.stock_movements'::regclass and tgname = 'refresh_reorder_point_from_stock_movement';
  if v_reorder_mode is not null and v_reorder_mode <> 'D' then
    alter table public.stock_movements disable trigger refresh_reorder_point_from_stock_movement;
  end if;

  for v_row in select * from public.ingredients order by id loop
    v_factor := 1;
    case lower(btrim(v_row.unit))
      when 'pc','pcs','piece','pieces' then v_unit := 'Pcs';
      when 'g','gram','grams' then v_unit := 'Grams';
      when 'ml','milliliter','milliliters','millilitre','millilitres' then v_unit := 'mL';
      when 'kg','kilogram','kilograms' then v_unit := 'Grams'; v_factor := 1000;
      when 'l','liter','liters','litre','litres' then v_unit := 'mL'; v_factor := 1000;
    end case;
    if v_factor <> 1 then
      update public.menu_item_ingredients set quantity = quantity * v_factor where ingredient_id = v_row.id;
      update public.stock_movements set adjustment = adjustment * v_factor where ingredient_id = v_row.id;
    end if;
    if v_row.unit is distinct from v_unit or v_factor <> 1 then
      update public.ingredients set unit = v_unit,
        current_stock = v_row.current_stock * v_factor,
        reorder_level = v_row.reorder_level * v_factor,
        unit_cost = v_row.unit_cost / v_factor
      where id = v_row.id;
    end if;
  end loop;

  if v_reorder_mode = 'O' then
    alter table public.stock_movements enable trigger refresh_reorder_point_from_stock_movement;
  elsif v_reorder_mode = 'A' then
    alter table public.stock_movements enable always trigger refresh_reorder_point_from_stock_movement;
  elsif v_reorder_mode = 'R' then
    alter table public.stock_movements enable replica trigger refresh_reorder_point_from_stock_movement;
  end if;
  -- Recalculate in base units so ROP is rounded at the new stock precision.
  if to_regprocedure('public.recalculate_ingredient_reorder_points(timestamp with time zone,bigint)') is not null then
    perform public.recalculate_ingredient_reorder_points(clock_timestamp());
  end if;
end;
$$;

alter table public.ingredients alter column unit set default 'Pcs';
alter table public.ingredients alter column unit set not null;
alter table public.ingredients drop constraint if exists ingredients_unit_check;
alter table public.ingredients add constraint ingredients_unit_check check (unit in ('Pcs','Grams','mL'));

-- Ledger and recipe amounts use the ingredient's unit implicitly. Prevent a
-- dimensional change from reinterpreting existing quantities or per-unit costs.
create or replace function public.protect_ingredient_unit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.unit is distinct from new.unit and (
    old.current_stock <> 0 or old.reorder_level <> 0 or coalesce(old.unit_cost,0) <> 0
    or exists(select 1 from public.menu_item_ingredients where ingredient_id = old.id)
    or exists(select 1 from public.stock_movements where ingredient_id = old.id)
  ) then
    raise exception 'Convert existing stock, recipes, sales history and costs together before changing the ingredient unit.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_ingredient_unit_change() from public,anon,authenticated,service_role;
drop trigger if exists protect_ingredient_unit_change on public.ingredients;
create trigger protect_ingredient_unit_change before update of unit on public.ingredients
  for each row execute function public.protect_ingredient_unit_change();
notify pgrst, 'reload schema';
commit;
