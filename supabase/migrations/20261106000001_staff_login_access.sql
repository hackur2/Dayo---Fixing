-- Staff logins are provisioned by the create-staff-account Edge Function. Keep
-- individual screen access in the profile so both the UI and RLS can enforce it.
begin;

alter table public.profiles
  add column if not exists allowed_routes text[] not null default array[]::text[];

alter table public.profiles
  drop constraint if exists profiles_allowed_routes_check;

alter table public.profiles
  add constraint profiles_allowed_routes_check
  check (allowed_routes <@ array[
    '/admin/kds',
    '/admin/order-taker',
    '/admin/order-summary'
  ]::text[]);

-- Preserve the current access level of staff who were already authorized before
-- per-page access existed. New staff must be assigned routes by the Edge Function.
update public.profiles
set allowed_routes = array[
  '/admin/kds',
  '/admin/order-taker',
  '/admin/order-summary'
]::text[]
where role = 'ADMIN'::public.app_role
  and cardinality(allowed_routes) = 0;

create or replace function public.has_route_access(p_allowed_routes text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.is_authorized
      and (
        profile.role = 'SUPER_ADMIN'::public.app_role
        or (
          profile.role = 'ADMIN'::public.app_role
          and profile.allowed_routes && p_allowed_routes
        )
      )
  )
$function$;

revoke all on function public.has_route_access(text[]) from public, anon, service_role;
grant execute on function public.has_route_access(text[]) to authenticated;

drop policy if exists "Staff add order items" on public.order_items;
create policy "Staff add order items" on public.order_items
  for insert to authenticated
  with check (public.has_route_access(array['/admin/order-taker']::text[]));

drop policy if exists "Staff read order items" on public.order_items;
create policy "Staff read order items" on public.order_items
  for select to authenticated
  using (public.has_route_access(array['/admin/kds', '/admin/order-summary']::text[]));

drop policy if exists "Staff create orders" on public.orders;
create policy "Staff create orders" on public.orders
  for insert to authenticated
  with check (public.has_route_access(array['/admin/order-taker']::text[]));

drop policy if exists "Staff read orders" on public.orders;
create policy "Staff read orders" on public.orders
  for select to authenticated
  using (public.has_route_access(array['/admin/kds', '/admin/order-taker', '/admin/order-summary']::text[]));

drop policy if exists "Staff update order status" on public.orders;
create policy "Staff update order status" on public.orders
  for update to authenticated
  using (public.has_route_access(array['/admin/kds']::text[]))
  with check (public.has_route_access(array['/admin/kds']::text[]));

create or replace function public.create_manual_order(
  p_customer_name text,
  p_order_type public.order_type,
  p_payment_method public.payment_method,
  p_payment_reference_number text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders;
  v_item jsonb;
  v_menu public.menu_items;
  v_variant public.menu_item_variants;
  v_variant_key text;
  v_price numeric(10,2);
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12,2) := 0;
  v_qty integer;
begin
  if not public.has_route_access(array['/admin/order-taker']::text[]) then
    raise exception 'Not authorized to use Order Taker' using errcode = '42501';
  end if;
  if p_payment_method = 'GCash' and nullif(trim(p_payment_reference_number),'') is null then raise exception 'GCash reference is required'; end if;
  if nullif(trim(p_customer_name), '') is null then raise exception 'Customer name is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  insert into public.orders(customer_name,order_type,source,payment_method,payment_reference_number,payment_status,notes,created_by)
    values(trim(p_customer_name),p_order_type,'Manual Order Taker',p_payment_method,nullif(trim(p_payment_reference_number),''),
      case when p_payment_method='Cash' then 'Paid' else 'Pending' end,coalesce(p_notes,''),auth.uid()) returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_menu from public.menu_items where id=(v_item->>'menuItemId')::bigint and is_active and is_available;
    if not found then raise exception 'A menu item is unavailable'; end if;
    v_variant_key := nullif(v_item->>'selectedVariantId','');
    if v_variant_key is null then v_price := v_menu.price;
    else select * into v_variant from public.menu_item_variants where menu_item_id=v_menu.id and variant_key=v_variant_key;
      if not found then raise exception 'A menu variant is unavailable'; end if;
      v_price := v_variant.price;
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_price is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid item price or quantity'; end if;
    insert into public.order_items(order_id,menu_item_id,item_name,selected_variant_key,variant_label,unit_price,quantity)
      values(v_order.id,v_menu.id,v_menu.name,v_variant_key,case when v_variant_key is null then null else v_variant.name end,v_price,v_qty);
    v_total := v_total + v_price*v_qty;
    v_items := v_items || jsonb_build_array(jsonb_build_object('menuItemId',v_menu.id,'name',v_menu.name,'selectedVariantId',v_variant_key,'variantLabel',case when v_variant_key is null then null else v_variant.name end,'price',v_price,'quantity',v_qty,'subtotal',v_price*v_qty));
  end loop;
  return jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'customerName',v_order.customer_name,'orderType',v_order.order_type,'paymentMethod',v_order.payment_method,'paymentReferenceNumber',v_order.payment_reference_number,'status',v_order.status,'notes',v_order.notes,'items',v_items,'totalAmount',v_total,'createdAt',v_order.created_at);
end;
$function$;

revoke all on function public.create_manual_order(text, public.order_type, public.payment_method, text, text, jsonb) from public, anon, service_role;
grant execute on function public.create_manual_order(text, public.order_type, public.payment_method, text, text, jsonb) to authenticated;

commit;
