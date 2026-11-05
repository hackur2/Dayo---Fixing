-- LOCAL SUPABASE SQL EDITOR ONLY. Paste the CLOUD result at the marker below.
-- Stop cloud-sync and pause all writes to the two apps before exporting.
-- The transaction takes a private local backup before replacing business rows.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog, public;

create temporary table dayo_cloud_snapshot (payload jsonb not null, checksum text not null) on commit drop;

-- PASTE THE ENTIRE local_insert_sql STATEMENT HERE (one INSERT into pg_temp).

do $dayo_import$
declare
  business_tables constant text[] := array[
    'ingredients', 'ingredient_archives', 'menu_categories', 'menu_variant_sets',
    'menu_variant_options', 'menu_items', 'menu_item_ingredients', 'menu_item_variants',
    'menu_item_variant_sets', 'combo_components', 'orders', 'order_items',
    'order_inventory_deductions', 'stock_movements', 'promotions', 'feedback',
    'staff', 'staff_shifts', 'suppliers'
  ];
  payload jsonb;
  checksum text;
  table_name text;
  target regclass;
  table_list text;
  rows_to_load jsonb;
  field_names jsonb;
  insert_columns text;
  auth_column text;
  backup_schema text := 'dayo_before_cloud_import_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS_US');
  trigger_row record;
  identity_column record;
  max_id bigint;
  sequence_value bigint;
  row_mismatch boolean;
begin
  if current_user <> 'postgres' or to_regclass('local_sync.worker_status') is null then
    raise exception 'Use the LOCAL Supabase SQL Editor with role postgres and local sync installed.';
  end if;
  if not pg_try_advisory_xact_lock(8122, 1) or exists (
    select 1 from local_sync.worker_status where heartbeat_at > clock_timestamp() - interval '45 seconds'
  ) then
    raise exception 'Stop cloud-sync and wait at least 45 seconds before running the local import.';
  end if;

  select s.payload, s.checksum into strict payload, checksum from pg_temp.dayo_cloud_snapshot s;
  if checksum is distinct from md5(payload::text)
     or payload->>'format' is distinct from 'dayo-business-v1'
     or jsonb_typeof(payload->'tables') is distinct from 'object'
     or (select count(*) from jsonb_object_keys(payload->'tables')) <> cardinality(business_tables) then
    raise exception 'Invalid snapshot. Copy the complete local_insert_sql cell from the cloud result.';
  end if;
  perform set_config('TimeZone', payload->>'timezone', true);

  select string_agg(format('public.%I', t), ', ') into table_list from unnest(business_tables) t;
  execute 'lock table ' || table_list || ' in access exclusive mode';
  lock table local_sync.outbox, local_sync.record_status, local_sync.batches,
             local_sync.sync_runs, local_sync.settings in access exclusive mode;

  foreach table_name in array business_tables loop
    rows_to_load := payload->'tables'->table_name;
    if jsonb_typeof(rows_to_load) is distinct from 'array' then
      raise exception 'Missing or invalid rows for %.', table_name;
    end if;
    if jsonb_array_length(rows_to_load) is distinct from (payload->'counts'->>table_name)::integer then
      raise exception 'Invalid row count for %.', table_name;
    end if;
    target := to_regclass(format('public.%I', table_name));
    select jsonb_agg(a.attname::text order by a.attname::text collate "C") into field_names
    from pg_attribute a where a.attrelid = target and a.attnum > 0 and not a.attisdropped;
    if field_names is null or field_names is distinct from payload->'columns'->table_name then
      raise exception 'Local and cloud columns differ for %. Local: %, cloud: %.',
        table_name, field_names, payload->'columns'->table_name;
    end if;
  end loop;

  execute format('create schema %I', backup_schema);
  execute format('revoke all on schema %I from public, anon, authenticated, service_role', backup_schema);
  foreach table_name in array business_tables loop
    execute format('create table %I.%I as table public.%I', backup_schema, table_name, table_name);
  end loop;
  foreach table_name in array array['outbox', 'record_status', 'batches', 'sync_runs', 'settings'] loop
    execute format('create table %I.%I as table local_sync.%I', backup_schema, 'sync_' || table_name, table_name);
  end loop;
  execute format('revoke all on all tables in schema %I from public, anon, authenticated, service_role', backup_schema);

  -- Record current user trigger modes. Internal foreign key checks stay enabled.
  create temporary table dayo_import_triggers on commit drop as
  select c.relname as table_name, t.tgname as trigger_name, t.tgenabled as mode
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relnamespace = 'public'::regnamespace and c.relname = any(business_tables)
    and not t.tgisinternal and t.tgenabled <> 'D';
  foreach table_name in array business_tables loop
    execute format('alter table public.%I disable trigger user', table_name);
  end loop;

  execute 'truncate table ' || table_list || ' continue identity restrict';
  set constraints all deferred;

  foreach table_name in array business_tables loop
    rows_to_load := payload->'tables'->table_name;
    target := to_regclass(format('public.%I', table_name));

    -- Keep links to existing local Auth users. Blank missing cloud-only links.
    auth_column := case table_name
      when 'orders' then 'created_by'
      when 'stock_movements' then 'created_by'
      when 'feedback' then 'reviewed_by'
      when 'staff' then 'auth_user_id'
      when 'ingredient_archives' then 'archived_by'
    end;
    if auth_column is not null then
      select coalesce(jsonb_agg(case
        when value->>auth_column is not null and not exists (
          select 1 from auth.users u where u.id = (value->>auth_column)::uuid
        ) then value || jsonb_build_object(auth_column, null::uuid)
        else value end), '[]'::jsonb) into rows_to_load
      from jsonb_array_elements(rows_to_load);
    end if;

    select string_agg(format('%I', a.attname), ', ' order by a.attnum) into insert_columns
    from pg_attribute a where a.attrelid = target and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
    execute format('insert into public.%1$I (%2$s) overriding system value
                    select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
                   table_name, insert_columns) using rows_to_load;

    -- Compare complete records including generated values such as subtotals.
    execute format('select exists (
      (select to_jsonb(t) from public.%1$I t except all select value from jsonb_array_elements($1))
      union all
      (select value from jsonb_array_elements($1) except all select to_jsonb(t) from public.%1$I t)
    )', table_name) into row_mismatch using rows_to_load;
    if row_mismatch then
      raise exception 'Imported values differ for %. Import rolled back.', table_name;
    end if;
  end loop;

  set constraints all immediate;
  for trigger_row in select * from pg_temp.dayo_import_triggers loop
    execute format('alter table public.%I enable%s trigger %I', trigger_row.table_name,
                   case trigger_row.mode when 'A' then ' always' when 'R' then ' replica' else '' end,
                   trigger_row.trigger_name);
  end loop;

  -- Advance owned ID sequences past both the local allocation and imported IDs.
  foreach table_name in array business_tables loop
    for identity_column in
      select a.attname, pg_get_serial_sequence(format('public.%I', table_name), a.attname) as seq
      from pg_attribute a
      where a.attrelid = to_regclass(format('public.%I', table_name)) and a.attnum > 0 and not a.attisdropped
        and a.atttypid in ('smallint'::regtype, 'integer'::regtype, 'bigint'::regtype)
    loop
      if identity_column.seq is null then continue; end if;
      execute format('select max(%I) from public.%I', identity_column.attname, table_name) into max_id;
      execute format('select last_value from %s', identity_column.seq::regclass) into sequence_value;
      if max_id >= sequence_value then
        execute format('alter sequence %s restart with %s', identity_column.seq::regclass, max_id + 1);
      end if;
    end loop;
  end loop;

  -- Keep old queue history but prevent pending local changes replaying to cloud.
  update local_sync.batches set superseded_at = clock_timestamp()
    where confirmed_at is null and superseded_at is null;
  update local_sync.outbox set sync_status = 'skipped', last_error = 'Superseded by cloud snapshot import'
    where sync_status in ('pending', 'failed', 'deferred');
  update local_sync.record_status set sync_status = 'skipped', last_error = 'Superseded by cloud snapshot import'
    where sync_status in ('pending', 'failed', 'deferred');
  update local_sync.sync_runs set status = 'failed', finished_at = clock_timestamp(),
      error = 'Superseded by cloud snapshot import'
    where status in ('queued', 'running');
  raise notice 'Verified business import. Local backup schema: %. Cloud row counts: %', backup_schema, payload->'counts';
end
$dayo_import$;

commit;
