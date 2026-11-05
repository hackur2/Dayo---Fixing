-- One-time ownership handoff for the current local outbox.
-- This updates cloud_sync metadata only. It does not update public business rows.
begin;

create temporary table local_handoff_targets (
  table_name text not null,
  row_key jsonb not null,
  source_version bigint not null,
  primary key (table_name, row_key)
) on commit drop;

insert into local_handoff_targets (table_name, row_key, source_version) values
  ('ingredients', '{"id": 10}'::jsonb, 634),
  ('ingredients', '{"id": 11}'::jsonb, 641),
  ('ingredients', '{"id": 12}'::jsonb, 644),
  ('ingredients', '{"id": 13}'::jsonb, 564),
  ('ingredients', '{"id": 14}'::jsonb, 569),
  ('ingredients', '{"id": 15}'::jsonb, 594),
  ('ingredients', '{"id": 16}'::jsonb, 587),
  ('ingredients', '{"id": 17}'::jsonb, 590),
  ('ingredients', '{"id": 21}'::jsonb, 597),
  ('ingredients', '{"id": 3}'::jsonb, 560),
  ('ingredients', '{"id": 4}'::jsonb, 572),
  ('ingredients', '{"id": 5}'::jsonb, 582),
  ('ingredients', '{"id": 9}'::jsonb, 630),
  ('menu_items', '{"id": 1}'::jsonb, 622),
  ('menu_items', '{"id": 10}'::jsonb, 638),
  ('menu_items', '{"id": 11}'::jsonb, 639),
  ('menu_items', '{"id": 12}'::jsonb, 586),
  ('menu_items', '{"id": 13}'::jsonb, 640),
  ('menu_items', '{"id": 14}'::jsonb, 628),
  ('menu_items', '{"id": 16}'::jsonb, 633),
  ('menu_items', '{"id": 17}'::jsonb, 621),
  ('menu_items', '{"id": 18}'::jsonb, 563),
  ('menu_items', '{"id": 19}'::jsonb, 568),
  ('menu_items', '{"id": 2}'::jsonb, 623),
  ('menu_items', '{"id": 20}'::jsonb, 592),
  ('menu_items', '{"id": 21}'::jsonb, 562),
  ('menu_items', '{"id": 23}'::jsonb, 643),
  ('menu_items', '{"id": 24}'::jsonb, 596),
  ('menu_items', '{"id": 25}'::jsonb, 579),
  ('menu_items', '{"id": 26}'::jsonb, 581),
  ('menu_items', '{"id": 27}'::jsonb, 575),
  ('menu_items', '{"id": 28}'::jsonb, 577),
  ('menu_items', '{"id": 29}'::jsonb, 578),
  ('menu_items', '{"id": 3}'::jsonb, 571),
  ('menu_items', '{"id": 30}'::jsonb, 580),
  ('menu_items', '{"id": 31}'::jsonb, 574),
  ('menu_items', '{"id": 4}'::jsonb, 632),
  ('menu_items', '{"id": 5}'::jsonb, 627),
  ('menu_items', '{"id": 6}'::jsonb, 636),
  ('menu_items', '{"id": 7}'::jsonb, 637),
  ('menu_items', '{"id": 9}'::jsonb, 629),
  ('stock_movements', '{"id": 1000000000018}'::jsonb, 565),
  ('stock_movements', '{"id": 1000000000019}'::jsonb, 570),
  ('stock_movements', '{"id": 1000000000020}'::jsonb, 573),
  ('stock_movements', '{"id": 1000000000021}'::jsonb, 583),
  ('stock_movements', '{"id": 1000000000022}'::jsonb, 588),
  ('stock_movements', '{"id": 1000000000023}'::jsonb, 591),
  ('stock_movements', '{"id": 1000000000024}'::jsonb, 595),
  ('stock_movements', '{"id": 1000000000025}'::jsonb, 598),
  ('stock_movements', '{"id": 1000000000026}'::jsonb, 609),
  ('stock_movements', '{"id": 1000000000027}'::jsonb, 620),
  ('stock_movements', '{"id": 1000000000028}'::jsonb, 631),
  ('stock_movements', '{"id": 1000000000029}'::jsonb, 635),
  ('stock_movements', '{"id": 1000000000030}'::jsonb, 642),
  ('stock_movements', '{"id": 1000000000031}'::jsonb, 645);

do $$
declare
  v_local_source uuid := '7e3a8e23-7342-4a19-9da2-2d0fc5e21565';
begin
  if (select count(*) from local_handoff_targets) <> 55 then
    raise exception 'Expected 55 local targets; no ownership changes made.';
  end if;
  if exists (select 1 from local_handoff_targets where source_version <= 1) then
    raise exception 'Invalid local source version; no ownership changes made.';
  end if;
  if exists (
    select 1
    from cloud_sync.records r
    join local_handoff_targets t using (table_name, row_key)
    where r.source_id = v_local_source
      and r.source_version >= t.source_version
  ) then
    raise exception 'A cloud record already owned by this local source has an incompatible version; no ownership changes made.';
  end if;
end $$;

with prior as materialized (
  select
    r.table_name,
    r.row_key,
    r.source_id as previous_source_id,
    r.source_version as previous_source_version,
    t.source_version - 1 as next_source_version
  from cloud_sync.records r
  join local_handoff_targets t using (table_name, row_key)
  where r.source_id <> '7e3a8e23-7342-4a19-9da2-2d0fc5e21565'::uuid
), updated as (
  update cloud_sync.records r
  set
    source_id = '7e3a8e23-7342-4a19-9da2-2d0fc5e21565'::uuid,
    source_version = prior.next_source_version,
    last_synced_at = clock_timestamp()
  from prior
  where r.table_name = prior.table_name and r.row_key = prior.row_key
  returning r.table_name, r.row_key
)
select
  prior.table_name,
  prior.row_key,
  prior.previous_source_id,
  prior.previous_source_version,
  prior.next_source_version
from prior
join updated using (table_name, row_key)
order by prior.table_name, prior.row_key::text;

commit;
