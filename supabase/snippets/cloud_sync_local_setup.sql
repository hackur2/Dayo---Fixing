-- LOCAL ONLY. Apply 20261030000003_safe_cloud_sync.sql first on both databases.
-- Upgrade without discarding the existing outbox or changing business rows.
begin;
create schema if not exists local_sync;
revoke all on schema local_sync from public,anon,authenticated,service_role;
create table if not exists local_sync.outbox (
  id bigint generated always as identity primary key,table_name text not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),row_data jsonb not null,
  created_at timestamptz not null default clock_timestamp(),synced_at timestamptz,
  attempts integer not null default 0,last_error text
);
alter table local_sync.outbox add column if not exists transaction_id bigint not null default 0;
alter table local_sync.outbox alter column transaction_id set default txid_current();
alter table local_sync.outbox add column if not exists row_key jsonb;
alter table local_sync.outbox add column if not exists sync_status text not null default 'pending';
alter table local_sync.outbox add column if not exists batch_id uuid;
create index if not exists local_sync_outbox_retry_idx on local_sync.outbox(id) where sync_status in ('pending','failed');
create table if not exists local_sync.settings (
  singleton boolean primary key default true check(singleton),source_id uuid not null default gen_random_uuid(),
  baseline_queued boolean not null default false,last_successful_sync_at timestamptz
);
insert into local_sync.settings(singleton) values(true) on conflict do nothing;
alter table local_sync.settings add column if not exists sync_window_seconds integer default 3600 check(sync_window_seconds > 0);
alter table local_sync.settings add column if not exists last_cloud_check_at timestamptz;
alter table local_sync.settings add column if not exists online_ordering_enabled boolean not null default false;
alter table local_sync.settings add column if not exists last_online_ordering_report_at timestamptz;
alter table local_sync.settings add column if not exists online_ordering_error text;
create table if not exists local_sync.record_status (
  table_name text,row_key jsonb,source_version bigint not null,sync_status text not null,
  last_synced_at timestamptz,last_error text,primary key(table_name,row_key)
);
create table if not exists local_sync.sync_runs (
  id uuid primary key default gen_random_uuid(),status text not null default 'queued',origin text not null,
  cutoff bigint not null,requested_by uuid,created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,finished_at timestamptz,synced_count integer not null default 0,
  failed_count integer not null default 0,error text
);
create table if not exists local_sync.batches (
  id uuid primary key default gen_random_uuid(),event_ids bigint[] not null,payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),confirmed_at timestamptz
);
alter table local_sync.batches add column if not exists superseded_at timestamptz;
alter table local_sync.batches add column if not exists replacement_id uuid;
create table if not exists local_sync.run_records (
  run_id uuid references local_sync.sync_runs(id),table_name text,row_key jsonb,outcome text not null,
  primary key(run_id,table_name,row_key)
);
create table if not exists local_sync.worker_status (
  singleton boolean primary key default true check(singleton),configured boolean not null default false,
  heartbeat_at timestamptz,error text
);
create index if not exists local_sync_record_status_idx on local_sync.record_status(sync_status);
create index if not exists local_sync_run_queue_idx on local_sync.sync_runs(status,created_at);
create index if not exists local_sync_batch_retry_idx on local_sync.batches(created_at) where confirmed_at is null;
create index if not exists local_sync_transaction_idx on local_sync.outbox(transaction_id,id) where sync_status in ('pending','failed');
insert into local_sync.worker_status(singleton) values(true) on conflict do nothing;
revoke all on all tables in schema local_sync from public,anon,authenticated,service_role;
revoke all on all sequences in schema local_sync from public,anon,authenticated,service_role;

create or replace function local_sync.queue_record(p_name text,p_operation text,p_row jsonb,p_transaction bigint default txid_current())
returns bigint language plpgsql security definer set search_path='' as $$
declare v_key jsonb;v_id bigint;v_status text;
begin
  if not coalesce(cloud_sync.allowed_table(p_name),false) then raise exception 'Unsupported sync table'; end if;
  v_key:=cloud_sync.row_key(to_regclass(format('public.%I',p_name)),p_row);
  if v_key is null then raise exception 'Sync capture requires a primary key on %',p_name; end if;
  v_status:=case when p_operation='DELETE' then 'skipped' else 'pending' end;
  if p_operation='DELETE' then
    update local_sync.outbox set sync_status='skipped' where table_name=p_name and row_key=v_key
      and batch_id is null and sync_status in ('pending','failed');
  end if;
  insert into local_sync.outbox(table_name,operation,row_data,row_key,transaction_id,sync_status)
    values(p_name,p_operation,p_row,v_key,p_transaction,v_status) returning id into v_id;
  insert into local_sync.record_status(table_name,row_key,source_version,sync_status)
    values(p_name,v_key,v_id,v_status) on conflict(table_name,row_key)
    do update set source_version=excluded.source_version,sync_status=excluded.sync_status,last_error=null;
  return v_id;
end; $$;
create or replace function local_sync.capture_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('app.sync_source',true)='cloud_mirror' then
    if tg_op='DELETE' then return old; end if;return new;
  end if;
  if tg_op='DELETE' then perform local_sync.queue_record(tg_table_name,tg_op,to_jsonb(old));return old;end if;
  perform local_sync.queue_record(tg_table_name,tg_op,to_jsonb(new));return new;
end; $$;
create or replace function local_sync.create_run(p_origin text,p_actor uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(8122,2);
  select id into v_id from local_sync.sync_runs where status in ('queued','running') order by created_at limit 1;
  if v_id is null then
    insert into local_sync.sync_runs(origin,requested_by,cutoff)
      select p_origin,p_actor,coalesce(max(id),0) from local_sync.outbox returning id into v_id;
  end if;
  return v_id;
end; $$;
-- Use business/order time for sales, not the time a historical import was queued.
-- Live inventory/menu edits use their recorded update time. Undated baseline
-- lookups cannot be claimed as newly registered just because they were imported.
create or replace function local_sync.event_registered_at(p_name text,p_row jsonb,p_transaction bigint,p_queued_at timestamptz)
returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare v_time timestamptz;
begin
  if p_name='orders' then return nullif(p_row->>'created_at','')::timestamptz;end if;
  if p_name in ('order_items','order_inventory_deductions') then
    select created_at into v_time from public.orders
      where id=case when p_row->>'order_id' ~ '^[0-9]+$' then (p_row->>'order_id')::bigint end;
    return coalesce(v_time,nullif(p_row->>'deducted_at','')::timestamptz);
  end if;
  if p_name in ('stock_movements','feedback') then return nullif(p_row->>'created_at','')::timestamptz;end if;
  if p_transaction=0 then
    return coalesce(nullif(p_row->>'created_at','')::timestamptz,nullif(p_row->>'updated_at','')::timestamptz);
  end if;
  return coalesce(nullif(p_row->>'updated_at','')::timestamptz,nullif(p_row->>'created_at','')::timestamptz,p_queued_at);
end; $$;

create or replace function local_sync.apply_sync_window() returns void
language plpgsql security definer set search_path='' as $$
declare v_seconds integer;v_now timestamptz:=clock_timestamp();v_cutoff timestamptz;
  b record;v_events jsonb;v_ids bigint[];v_replacement uuid;
begin
  select sync_window_seconds into v_seconds from local_sync.settings;
  if v_seconds is null then return;end if;
  v_cutoff:=v_now-make_interval(secs=>v_seconds);
  for b in select * from local_sync.batches where confirmed_at is null and superseded_at is null order by created_at,id for update loop
    select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb) into v_events
      from jsonb_array_elements(b.payload) with ordinality e(value,ordinality)
      join local_sync.outbox o on o.id=(e.value->>'version')::bigint
      where local_sync.event_registered_at(o.table_name,e.value->'row_data',o.transaction_id,o.created_at) between v_cutoff and v_now;
    if jsonb_array_length(v_events)=jsonb_array_length(b.payload) then continue;end if;
    v_replacement:=null;
    update local_sync.outbox o set sync_status='deferred'
      where o.id=any(b.event_ids) and o.sync_status in ('pending','failed') and not exists(
        select 1 from jsonb_to_recordset(v_events) e(table_name text,row_key jsonb)
        where e.table_name=o.table_name and e.row_key=o.row_key);
    update local_sync.record_status s set sync_status='deferred'
      from local_sync.outbox o where o.id=any(b.event_ids) and o.sync_status='deferred'
      and s.table_name=o.table_name and s.row_key=o.row_key and s.source_version=o.id;
    if jsonb_array_length(v_events)>0 then
      select array_agg(o.id order by o.id) into v_ids from local_sync.outbox o
        where o.id=any(b.event_ids) and o.sync_status in ('pending','failed');
      insert into local_sync.batches(event_ids,payload) values(v_ids,v_events) returning id into v_replacement;
      update local_sync.outbox set batch_id=v_replacement where id=any(v_ids);
    end if;
    -- Keep the original ID, payload, event history and errors for auditing.
    update local_sync.batches set superseded_at=v_now,replacement_id=v_replacement where id=b.id;
  end loop;
  update local_sync.outbox o set sync_status='deferred'
    where o.batch_id is null and o.sync_status in ('pending','failed')
    and not coalesce(local_sync.event_registered_at(o.table_name,o.row_data,o.transaction_id,o.created_at) between v_cutoff and v_now,false);
  update local_sync.record_status s set sync_status='deferred' from local_sync.outbox o
    where o.sync_status='deferred' and s.table_name=o.table_name and s.row_key=o.row_key and s.source_version=o.id;
end; $$;

create or replace function local_sync.claim_batch(p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_batch local_sync.batches%rowtype;v_cutoff bigint;v_tx bigint;v_ids bigint[];v_events jsonb;
begin
  perform local_sync.apply_sync_window();
  select cutoff into strict v_cutoff from local_sync.sync_runs where id=p_run;
  select * into v_batch from local_sync.batches where confirmed_at is null and superseded_at is null
    and event_ids[1]<=v_cutoff order by created_at,id limit 1;
  if not found then
    select transaction_id into v_tx from local_sync.outbox where id<=v_cutoff
      and sync_status in ('pending','failed') and batch_id is null order by id limit 1;
    if not found then return null;end if;
    -- A transaction may allocate IDs on both sides of another transaction's
    -- cutoff before committing. Once visible, include every member together.
    select array_agg(id order by id) into v_ids from local_sync.outbox where transaction_id=v_tx
      and sync_status in ('pending','failed') and batch_id is null;
    select jsonb_agg(jsonb_build_object('table_name',table_name,'row_key',row_key,'operation',operation,'row_data',row_data,'version',id::text) order by id)
      into v_events from (select distinct on(table_name,row_key) * from local_sync.outbox where id=any(v_ids) order by table_name,row_key,id desc) latest;
    insert into local_sync.batches(event_ids,payload) values(v_ids,v_events) returning * into v_batch;
    update local_sync.outbox set batch_id=v_batch.id where id=any(v_ids);
  end if;
  -- Preserve exact bigint IDs by sending JSON as text, never via JS Number.
  return jsonb_build_object('id',v_batch.id,'payload',v_batch.payload::text,'record_count',jsonb_array_length(v_batch.payload));
end; $$;
create or replace function local_sync.finish_batch(p_batch uuid,p_run uuid,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_batch local_sync.batches%rowtype;v_event jsonb;v_status text;v_time timestamptz:=clock_timestamp();
begin
  select * into strict v_batch from local_sync.batches where id=p_batch for update;
  if v_batch.confirmed_at is not null then return;end if;
  v_status:=case when p_error is null then 'synced' else 'failed' end;
  update local_sync.outbox set sync_status=v_status,attempts=attempts+1,last_error=p_error,
    synced_at=case when p_error is null then v_time else synced_at end where id=any(v_batch.event_ids);
  update local_sync.record_status s set sync_status=v_status,last_error=p_error,
    last_synced_at=case when p_error is null then v_time else s.last_synced_at end
    from jsonb_to_recordset(v_batch.payload) e(table_name text,row_key jsonb,version bigint)
    where s.table_name=e.table_name and s.row_key=e.row_key and s.source_version<=e.version;
  insert into local_sync.run_records(run_id,table_name,row_key,outcome)
    select p_run,e.table_name,e.row_key,v_status
    from jsonb_to_recordset(v_batch.payload) e(table_name text,row_key jsonb)
    on conflict(run_id,table_name,row_key) do update set outcome=excluded.outcome;
  if p_error is null then
    update local_sync.batches set confirmed_at=v_time where id=p_batch;
    update local_sync.settings set last_successful_sync_at=v_time;
  end if;
  update local_sync.sync_runs set
    synced_count=(select count(*) from local_sync.run_records where run_id=p_run and outcome='synced'),
    failed_count=(select count(*) from local_sync.run_records where run_id=p_run and outcome='failed') where id=p_run;
end; $$;
create or replace function public.request_cloud_sync() returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]),false) then
    raise exception 'Only an authorized Super Admin can sync to cloud' using errcode='42501';
  end if;
  if not exists(select 1 from local_sync.worker_status where configured and heartbeat_at>clock_timestamp()-interval '30 seconds') then
    raise exception 'Cloud sync is unavailable. Check the local sync service; local changes are saved.' using errcode='55000';
  end if;
  return local_sync.create_run('manual',auth.uid());
end; $$;
create or replace function public.get_cloud_sync_status(p_run_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_run jsonb;v_result jsonb;
begin
  if not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]),false) then
    raise exception 'Only an authorized Super Admin can view sync status' using errcode='42501';
  end if;
  select to_jsonb(r) into v_run from local_sync.sync_runs r where p_run_id is null or r.id=p_run_id order by r.created_at desc,r.id desc limit 1;
  select jsonb_build_object('last_successful_sync_at',s.last_successful_sync_at,
    'last_cloud_check_at',s.last_cloud_check_at,'window_seconds',s.sync_window_seconds,
    'deferred_count',(select count(*) from local_sync.record_status where sync_status='deferred'),
    'synced_count',(select count(*) from local_sync.record_status where sync_status='synced'),
    'worker_available',coalesce(w.configured and w.heartbeat_at>clock_timestamp()-interval '30 seconds',false),
    'run',v_run,'pending_count',(select count(*) from local_sync.record_status where sync_status in ('pending','failed')),
    'failed_count',(select count(*) from local_sync.record_status where sync_status='failed'),
    'skipped_count',(select count(*) from local_sync.record_status where sync_status='skipped')) into v_result
    from local_sync.settings s cross join local_sync.worker_status w;
  return v_result;
end; $$;
revoke all on all functions in schema local_sync from public,anon,authenticated,service_role;
revoke all on function public.request_cloud_sync() from public,anon,authenticated,service_role;
revoke all on function public.get_cloud_sync_status(uuid) from public,anon,authenticated,service_role;
grant execute on function public.request_cloud_sync(),public.get_cloud_sync_status(uuid) to authenticated;

-- Local-only Super Admin control. The worker copies this setting to the cloud
-- with a heartbeat; it is never exposed as a write operation in Vercel.
create or replace function public.set_local_online_ordering_enabled(p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]),false) then
    raise exception 'Only an authorized Super Admin can change online ordering' using errcode='42501';
  end if;
  update local_sync.settings set online_ordering_enabled=p_enabled,online_ordering_error=null where singleton=true;
  return p_enabled;
end; $$;
create or replace function public.get_local_online_ordering_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_settings local_sync.settings%rowtype;v_worker local_sync.worker_status%rowtype;
begin
  if not coalesce(public.has_app_role(array['SUPER_ADMIN']::public.app_role[]),false) then
    raise exception 'Only an authorized Super Admin can view online ordering' using errcode='42501';
  end if;
  select * into strict v_settings from local_sync.settings where singleton=true;
  select * into strict v_worker from local_sync.worker_status where singleton=true;
  return jsonb_build_object(
    'manual_enabled',v_settings.online_ordering_enabled,
    'local_online',coalesce(v_worker.configured and v_worker.heartbeat_at>clock_timestamp()-interval '30 seconds'
      and v_settings.last_online_ordering_report_at>clock_timestamp()-interval '45 seconds',false),
    'effective_enabled',coalesce(v_settings.online_ordering_enabled and v_worker.configured
      and v_worker.heartbeat_at>clock_timestamp()-interval '30 seconds'
      and v_settings.last_online_ordering_report_at>clock_timestamp()-interval '45 seconds',false),
    'last_cloud_report_at',v_settings.last_online_ordering_report_at,
    'error',v_settings.online_ordering_error
  );
end; $$;
revoke all on function public.set_local_online_ordering_enabled(boolean) from public,anon,authenticated,service_role;
revoke all on function public.get_local_online_ordering_status() from public,anon,authenticated,service_role;
grant execute on function public.set_local_online_ordering_enabled(boolean),public.get_local_online_ordering_status() to authenticated;

do $$
declare v_table record;v_row jsonb;v_old record;
begin
  for v_table in select c.oid::regclass as tbl,c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and cloud_sync.allowed_table(c.relname) order by c.relname loop
    execute format('lock table %s in share row exclusive mode',v_table.tbl);
    execute format('drop trigger if exists local_sync_capture_change on %s',v_table.tbl);
    execute format('create trigger local_sync_capture_change after insert or update or delete on %s for each row execute function local_sync.capture_change()',v_table.tbl);
  end loop;
  for v_old in select id,table_name,row_data from local_sync.outbox where row_key is null order by id loop
    update local_sync.outbox set row_key=cloud_sync.row_key(to_regclass(format('public.%I',v_old.table_name)),v_old.row_data) where id=v_old.id;
  end loop;
  update local_sync.outbox set sync_status='synced' where synced_at is not null and sync_status='pending';
  update local_sync.outbox set sync_status='skipped' where operation='DELETE' and sync_status in ('pending','failed');
  update local_sync.outbox o set sync_status='skipped' where o.batch_id is null and o.sync_status in ('pending','failed')
    and exists(select 1 from local_sync.outbox d where d.table_name=o.table_name and d.row_key=o.row_key and d.operation='DELETE' and d.id>o.id);
  insert into local_sync.record_status(table_name,row_key,source_version,sync_status,last_synced_at,last_error)
    select distinct on(table_name,row_key) table_name,row_key,id,sync_status,synced_at,last_error
    from local_sync.outbox where row_key is not null order by table_name,row_key,id desc
    on conflict(table_name,row_key) do update set source_version=excluded.source_version,
      sync_status=excluded.sync_status,last_synced_at=excluded.last_synced_at,last_error=excluded.last_error
      where local_sync.record_status.source_version<excluded.source_version;
  -- Legacy events have no recoverable transaction boundary. Group their entire
  -- backlog and this one-time current snapshot into a single atomic baseline.
  if not (select baseline_queued from local_sync.settings) then
    for v_table in select c.oid::regclass as tbl,c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and cloud_sync.allowed_table(c.relname) order by c.relname loop
      for v_row in execute format('select to_jsonb(t) from %s t',v_table.tbl) loop
        perform local_sync.queue_record(v_table.name,'INSERT',v_row,0);
      end loop;
    end loop;
    update local_sync.settings set baseline_queued=true;
  end if;
end; $$;
-- Do not rewind a sequence whose highest rows have since been removed.
do $$ declare r record;v_max bigint;v_last bigint;begin
  for r in select table_schema,table_name,column_name,pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) as seq
    from information_schema.columns where table_schema='public' and is_identity='YES' and data_type='bigint' loop
    execute format('select coalesce(max(%I),0) from %I.%I',r.column_name,r.table_schema,r.table_name) into v_max;
    execute format('select last_value from %s',r.seq) into v_last;
    perform setval(r.seq,greatest(1000000000000::bigint,v_max+1,v_last+1),false);
  end loop;
end; $$;
notify pgrst,'reload schema';
commit;
