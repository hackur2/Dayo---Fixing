-- Run this entire file in Supabase SQL Editor on the primary and mirror (if used).
-- Existing ingredient quantities and expiry handling are unchanged.
begin;
alter table public.ingredients
  add column if not exists unit_cost numeric(14,4) check (unit_cost >= 0);
notify pgrst, 'reload schema';
commit;
select id, name, current_stock, unit, unit_cost from public.ingredients order by name;
