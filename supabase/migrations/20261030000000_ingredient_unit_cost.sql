-- Cost is in pesos per ingredient unit (for example per kg, piece, or ml).
-- NULL means the cost has not been entered; it is not an assumed zero cost.
alter table public.ingredients
  add column if not exists unit_cost numeric(14,4) check (unit_cost >= 0);
notify pgrst, 'reload schema';
