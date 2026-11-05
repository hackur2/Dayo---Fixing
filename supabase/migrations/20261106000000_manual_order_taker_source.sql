-- Apply to both databases with cloud-sync stopped. Finish eligible legacy order uploads first.
begin;

do $$
begin
  if to_regclass('local_sync.outbox') is not null then
    if not pg_try_advisory_xact_lock(8122, 1) then
      raise exception 'Stop cloud-sync before renaming the manual order source';
    end if;
    if to_regclass('local_sync.batches') is null then
      raise exception 'Upgrade local cloud sync before renaming the manual order source';
    end if;
  end if;
end;
$$;

-- Prevent a concurrent order write from queuing a legacy value during cutover.
lock table public.orders in access exclusive mode;

do $$
begin
  if to_regclass('local_sync.outbox') is not null then
    if exists (
      select 1 from local_sync.outbox
      where table_name = 'orders' and sync_status in ('pending', 'failed')
        and row_data->>'source' = 'Manual POS'
    ) or exists (
      select 1 from local_sync.batches b
      cross join lateral jsonb_array_elements(b.payload) e
      where b.confirmed_at is null and b.superseded_at is null
        and e->>'table_name' = 'orders' and e->'row_data'->>'source' = 'Manual POS'
    ) then
      raise exception 'Resolve queued Manual POS orders before applying this migration';
    end if;
  end if;
end;
$$;

-- Accept the old spelling at the write boundary for the existing RPC and seed SQL.
create or replace function public.normalize_manual_order_source()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source = 'Manual POS' then
    new.source := 'Manual Order Taker';
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_manual_order_source() from public, anon, authenticated, service_role;

drop trigger if exists normalize_manual_order_source on public.orders;
create trigger normalize_manual_order_source
before insert or update of source on public.orders
for each row execute function public.normalize_manual_order_source();

alter table public.orders drop constraint orders_source_check;

-- Preserve update timestamps and avoid emitting sync events for a coordinated rename.
set local app.sync_source = 'cloud_mirror';
update public.orders set source = 'Manual Order Taker' where source = 'Manual POS';

alter table public.orders add constraint orders_source_check
check (source in ('QR Order', 'Manual Order Taker'));

-- Normalize the last-confirmed values as well so the rename alone isn't a conflict.
-- Historical outbox events, batch payloads, receipt hashes, and versions stay intact.
do $$
begin
  if to_regclass('cloud_sync.records') is not null then
    update cloud_sync.records
    set row_data = jsonb_set(row_data, '{source}', '"Manual Order Taker"'::jsonb)
    where table_name = 'orders' and row_data->>'source' = 'Manual POS';
  end if;
end;
$$;

commit;
