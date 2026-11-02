-- Cache table metadata once per table instead of per record in large atomic batches.
-- Bound this service-only RPC to 90 seconds; browser queries keep their defaults.
begin;
create or replace function public.apply_cloud_sync_batch(p_source_id uuid,p_batch_id uuid,p_events_json text)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '90s' as $$
declare
  v_events jsonb := p_events_json::jsonb; v_event jsonb; v_row jsonb; v_current jsonb;
  v_source jsonb; v_remote jsonb; v_key jsonb; v_meta cloud_sync.records%rowtype;
  v_table regclass; v_name text; v_columns text; v_select text; v_assign text; v_match text;
  v_projection text[]; v_pk text[]; v_version bigint; v_has_meta boolean;
  v_receipt cloud_sync.receipts%rowtype; v_hash text; v_count integer := 0;
  v_inserted integer := 0; v_updated integer := 0; v_unchanged integer := 0; v_result jsonb;
  v_auth_columns text[] := array['created_by','reviewed_by','auth_user_id','archived_by'];
  v_last_name text; v_all_columns text[]; v_final_columns text[]; v_auth_nulls jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Cloud sync requires the service role' using errcode='42501'; end if;
  if p_source_id is null or p_batch_id is null or jsonb_typeof(v_events) is distinct from 'array' then
    raise exception 'A source, batch ID and event array are required' using errcode='22023';
  end if;
  v_hash := md5(v_events::text);
  perform pg_advisory_xact_lock(hashtextextended(p_source_id::text||p_batch_id::text,0));
  select * into v_receipt from cloud_sync.receipts where source_id=p_source_id and batch_id=p_batch_id;
  if found then
    if v_receipt.payload_hash <> v_hash then raise exception 'Batch payload changed during retry' using errcode='22023'; end if;
    return v_receipt.result;
  end if;
  if exists(select 1 from jsonb_array_elements(v_events) e group by e->>'table_name',e->'row_key' having count(*)>1) then
    raise exception 'A batch must contain only the latest version of each record' using errcode='22023';
  end if;
  perform set_config('app.sync_source','cloud_mirror',true);
  set constraints all deferred;
  for v_event in select value from jsonb_array_elements(v_events) order by value->>'table_name',(value->'row_key')::text loop
    v_name := v_event->>'table_name'; v_version := (v_event->>'version')::bigint;
    if not coalesce(cloud_sync.allowed_table(v_name),false) or v_event->>'operation' not in ('INSERT','UPDATE')
      or v_event->>'operation' is null or v_version is null or v_version<=0 then
      raise exception 'Unsupported cloud sync event; deletions are never applied' using errcode='22023';
    end if;
    if v_last_name is distinct from v_name then
      v_table := to_regclass(format('public.%I',v_name));
      if v_table is null then raise exception 'Cloud schema needs the % table',v_name using errcode='22023'; end if;
      select array_agg(a.attname order by a.attnum),
        array_agg(a.attname order by a.attnum) filter(where a.attgenerated='' and not a.attname=any(v_auth_columns)),
        coalesce(jsonb_object_agg(a.attname,null::text) filter(where a.attname=any(v_auth_columns)),'{}'::jsonb),
        string_agg(format('%I',a.attname),',' order by a.attnum) filter(where a.attgenerated=''),
        string_agg(format('s.%I',a.attname),',' order by a.attnum) filter(where a.attgenerated='')
      into v_all_columns,v_projection,v_auth_nulls,v_columns,v_select
      from pg_attribute a where a.attrelid=v_table and a.attnum>0 and not a.attisdropped;
      select array_agg(a.attname order by k.ordinality) into v_pk from pg_index i
        cross join lateral unnest(i.indkey) with ordinality k(attnum,ordinality)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=v_table and i.indisprimary;
      if v_pk is null then raise exception 'Sync table needs a primary key' using errcode='22023'; end if;
      select string_agg(format('t.%I is not distinct from s.%I',k,k),' and ') into v_match from unnest(v_pk) k;
      select string_agg(format('%I=s.%I',k,k),',') into v_assign from unnest(v_projection) k where not k=any(v_pk);
      v_last_name := v_name;
    end if;
    v_row := v_event->'row_data';
    if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'A complete record is required' using errcode='22023'; end if;
    if not (v_row ?& v_projection) or not (v_all_columns @> array(select jsonb_object_keys(v_row))) then
      raise exception 'Local and cloud schemas differ for %',v_name using errcode='22023';
    end if;
    v_row := v_row || v_auth_nulls;
    execute format('select to_jsonb(s) from jsonb_populate_record(null::%s,$1) s',v_table) into v_row using v_row;
    v_key := cloud_sync.row_key(v_table,v_row);
    if v_key is null or exists(select 1 from jsonb_each(v_key) k where k.value='null'::jsonb)
      or v_key is distinct from v_event->'row_key' then raise exception 'Invalid record ID' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_name||v_key::text,0));
    execute format('select to_jsonb(t) from %s t,jsonb_populate_record(null::%s,$1) s where %s for update of t',v_table,v_table,v_match)
      into v_current using v_row;
    select jsonb_object_agg(k,v_row->k) into v_source from unnest(v_projection) k;
    select jsonb_object_agg(k,v_current->k) into v_remote from unnest(v_projection) k;
    select * into v_meta from cloud_sync.records where table_name=v_name and row_key=v_key;
    v_has_meta := found;
    if v_has_meta and v_meta.source_id<>p_source_id then
      raise exception 'Cloud conflict: % % belongs to another source',v_name,v_key using errcode='40001';
    end if;
    if v_has_meta and v_version<v_meta.source_version then
      raise exception 'Cloud conflict: an older source version cannot replace % %',v_name,v_key using errcode='40001';
    end if;
    if v_current is not null and v_source=v_remote then
      v_unchanged := v_unchanged+1;
    else
      if v_has_meta and (v_current is null or v_remote is distinct from v_meta.row_data) then
        raise exception 'Cloud conflict: % % changed independently',v_name,v_key using errcode='40001';
      end if;
      if v_current is not null and not v_has_meta and (
        not v_source ? 'updated_at' or v_source->>'updated_at' is null or v_remote->>'updated_at' is null
        or (v_source->>'updated_at')::timestamptz <= (v_remote->>'updated_at')::timestamptz
      ) then raise exception 'Cloud conflict: % % has newer or unversioned data',v_name,v_key using errcode='40001'; end if;
      if v_has_meta and v_version=v_meta.source_version then raise exception 'Source version reused with different data' using errcode='40001'; end if;
      if v_current is null then
        execute format('insert into %s (%s) overriding system value select %s from jsonb_populate_record(null::%s,$1) s',v_table,v_columns,v_select,v_table) using v_row;
        v_inserted := v_inserted+1;
      else
        if v_assign is not null then execute format('update %s t set %s from jsonb_populate_record(null::%s,$1) s where %s',v_table,v_assign,v_table,v_match) using v_row; end if;
        v_updated := v_updated+1;
      end if;
    end if;
    insert into cloud_sync.records(table_name,row_key,source_id,source_version,row_data)
      values(v_name,v_key,p_source_id,v_version,v_source)
      on conflict(table_name,row_key) do update set source_version=excluded.source_version,row_data=excluded.row_data,last_synced_at=clock_timestamp();
    v_count := v_count+1;
  end loop;
  -- Validate deferred relations before recording a successful receipt.
  set constraints all immediate;
  -- Also verify the final saved values after every trigger has run. A custom
  -- cloud trigger or different generated expression must never produce a false
  -- success or silently change an earlier record in the same batch.
  v_last_name := null;
  for v_event in select value from jsonb_array_elements(v_events) order by value->>'table_name' loop
    v_name := v_event->>'table_name';
    if v_last_name is distinct from v_name then
      v_table:=to_regclass(format('public.%I',v_name));
      select string_agg(format('t.%I is not distinct from s.%I',a.attname,a.attname),' and ')
        into v_match from pg_index i cross join lateral unnest(i.indkey) k(attnum)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=v_table and i.indisprimary;
      select array_agg(a.attname) into v_final_columns from pg_attribute a where a.attrelid=v_table
        and a.attnum>0 and not a.attisdropped and not a.attname=any(v_auth_columns);
      v_last_name := v_name;
    end if;
    execute format('select to_jsonb(s) from jsonb_populate_record(null::%s,$1) s',v_table) into v_row using v_event->'row_data';
    execute format('select to_jsonb(t) from %s t,jsonb_populate_record(null::%s,$1) s where %s',v_table,v_table,v_match)
      into v_current using v_row;
    select array_agg(k) into v_projection from unnest(v_final_columns) k where (v_event->'row_data') ? k;
    select jsonb_object_agg(k,v_row->k),jsonb_object_agg(k,v_current->k) into v_source,v_remote from unnest(v_projection) k;
    if v_current is null or v_source is distinct from v_remote then
      raise exception 'Cloud schema or trigger changed the mirrored record in %',v_event->>'table_name' using errcode='22023';
    end if;
  end loop;
  v_result := jsonb_build_object('batch_id',p_batch_id,'record_count',v_count,'inserted',v_inserted,'updated',v_updated,'unchanged',v_unchanged);
  insert into cloud_sync.receipts(source_id,batch_id,payload_hash,result) values(p_source_id,p_batch_id,v_hash,v_result);
  return v_result;
end; $$;
revoke all on function public.apply_cloud_sync_batch(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.apply_cloud_sync_batch(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
notify pgrst,'reload config';
commit;
