-- PROPOSED dashboard timeout correction; not applied automatically.
-- Adds an index for the existing order-to-lines relationship without changing rows.
-- A rollback benchmark of the slow later page dropped below the 8s API limit.
begin;
set local lock_timeout = '5s';
create index if not exists order_items_order_id_idx on public.order_items(order_id);
commit;
