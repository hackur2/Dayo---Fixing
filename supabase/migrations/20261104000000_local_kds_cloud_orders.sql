-- The local Docker KDS must receive orders placed through the cloud/Vercel
-- customer menu. Direct table reads are intentionally revoked from service_role,
-- so expose only the active preparation queue through this guarded RPC.
create or replace function public.get_active_orders_for_local_kds()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the local sync worker may read cloud KDS orders' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'order', to_jsonb(o),
        'items', coalesce((
          select jsonb_agg(to_jsonb(oi) order by oi.id)
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb)
      )
      order by o.created_at, o.id
    )
    from public.orders o
    where o.status in ('Pending', 'Preparing', 'Ready')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_active_orders_for_local_kds() from public, anon, authenticated, service_role;
grant execute on function public.get_active_orders_for_local_kds() to service_role;
