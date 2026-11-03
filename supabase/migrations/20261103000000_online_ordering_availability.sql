-- Online ordering is enabled only when the local Docker operator has opted in
-- and its worker has recently reached the cloud. This migration is applied to
-- both databases; the worker updates the local row directly and reports to the
-- cloud through the service-role-only RPC below.
begin;

create table if not exists public.online_ordering_status (
  singleton boolean primary key default true check (singleton),
  manual_enabled boolean not null default false,
  local_heartbeat_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.online_ordering_status(singleton) values(true) on conflict do nothing;
alter table public.online_ordering_status enable row level security;
revoke all on table public.online_ordering_status from public, anon, authenticated, service_role;

create or replace function public.online_ordering_is_available()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(manual_enabled and local_heartbeat_at > clock_timestamp() - interval '45 seconds', false)
  from public.online_ordering_status
  where singleton = true
$$;

create or replace function public.get_online_ordering_status()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'manual_enabled', s.manual_enabled,
    'local_online', coalesce(s.local_heartbeat_at > clock_timestamp() - interval '45 seconds', false),
    'effective_enabled', public.online_ordering_is_available(),
    'last_local_heartbeat_at', s.local_heartbeat_at
  )
  from public.online_ordering_status s
  where s.singleton = true
$$;

-- This endpoint deliberately accepts only the server-side Docker worker. The
-- browser never receives the cloud service-role key needed to call it.
create or replace function public.report_local_online_ordering(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the local sync worker may report store availability' using errcode = '42501';
  end if;

  update public.online_ordering_status
  set manual_enabled = p_enabled,
      local_heartbeat_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where singleton = true
  returning jsonb_build_object(
    'manual_enabled', manual_enabled,
    'local_online', true,
    'effective_enabled', manual_enabled,
    'last_local_heartbeat_at', local_heartbeat_at
  ) into v_result;
  return v_result;
end;
$$;

-- Enforce the availability check at the database boundary. A disabled checkout
-- button is only a convenience; direct RPC calls must be rejected too.
create or replace function public.reject_unavailable_customer_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The local-to-cloud mirror replays historical local orders. It must not be
  -- rejected because the live cloud availability setting has since changed.
  if current_setting('app.sync_source', true) = 'cloud_mirror' then
    return new;
  end if;

  if new.source = 'QR Order' and not public.online_ordering_is_available() then
    raise exception 'Online ordering is temporarily unavailable. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_unavailable_customer_order on public.orders;
create trigger reject_unavailable_customer_order
before insert on public.orders
for each row execute function public.reject_unavailable_customer_order();

revoke all on function public.online_ordering_is_available() from public, anon, authenticated, service_role;
revoke all on function public.get_online_ordering_status() from public, anon, authenticated, service_role;
revoke all on function public.report_local_online_ordering(boolean) from public, anon, authenticated, service_role;
revoke all on function public.reject_unavailable_customer_order() from public, anon, authenticated, service_role;
grant execute on function public.get_online_ordering_status() to anon, authenticated;
grant execute on function public.report_local_online_ordering(boolean) to service_role;

commit;
