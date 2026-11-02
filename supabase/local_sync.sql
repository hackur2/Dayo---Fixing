-- Local-only change queue. Loaded after migrations and seed data by the CLI.
create schema if not exists local_sync;
revoke all on schema local_sync from public, anon, authenticated, service_role;

create table if not exists local_sync.outbox (
  id bigint generated always as identity primary key,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists local_sync_outbox_pending_idx
  on local_sync.outbox (id) where synced_at is null;

create or replace function local_sync.capture_change()
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

  if tg_op = 'DELETE' then
    insert into local_sync.outbox (table_name, operation, row_data)
    values (tg_table_name, tg_op, to_jsonb(old));
    return old;
  end if;

  insert into local_sync.outbox (table_name, operation, row_data)
  values (tg_table_name, tg_op, to_jsonb(new));
  return new;
end;
$$;

revoke all on function local_sync.capture_change() from public, anon, authenticated, service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'combo_components',
    'feedback',
    'ingredients',
    'ingredient_archives',
    'menu_categories',
    'menu_item_ingredients',
    'menu_item_variant_sets',
    'menu_item_variants',
    'menu_items',
    'menu_variant_options',
    'menu_variant_sets',
    'order_inventory_deductions',
    'order_items',
    'orders',
    'promotions',
    'staff',
    'staff_shifts',
    'stock_movements'
  ] loop
    execute format('drop trigger if exists local_sync_capture_change on public.%I', target_table);
    execute format(
      'create trigger local_sync_capture_change after insert or update or delete on public.%I for each row execute function local_sync.capture_change()',
      target_table
    );
  end loop;
end;
$$;

-- New local rows use a high ID range so they cannot collide with legacy cloud IDs.
do $$
declare
  target record;
  current_max bigint;
begin
  for target in
    select table_schema, table_name, column_name,
           pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) as sequence_name
    from information_schema.columns
    where table_schema = 'public'
      and is_identity = 'YES'
      and data_type = 'bigint'
  loop
    execute format('select coalesce(max(%I), 0) from %I.%I', target.column_name, target.table_schema, target.table_name)
      into current_max;
    perform setval(target.sequence_name, greatest(1000000000000::bigint, current_max + 1), false);
  end loop;
end;
$$;
