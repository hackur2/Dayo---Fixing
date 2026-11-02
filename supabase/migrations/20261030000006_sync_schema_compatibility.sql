-- Match the existing cloud shape without clearing stock, changing expiry dates,
-- or enabling expiry automation. Quantity unit conversion is a separate migration.
begin;
alter table public.ingredients add column if not exists archived_at timestamptz;
alter table public.ingredients add column if not exists expiry_discarded_stock numeric not null default 0 check (expiry_discarded_stock >= 0);
alter table public.ingredients add column if not exists stock_expired_at timestamptz;
alter table public.ingredient_archives add column if not exists archive_reason text not null default 'deleted' check (archive_reason in ('deleted','expired'));
alter table public.ingredient_archives add column if not exists restored_at timestamptz;
notify pgrst,'reload schema';
commit;
