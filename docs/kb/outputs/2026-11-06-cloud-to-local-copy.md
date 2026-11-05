# Copy DaYo business data from cloud to local

On 2026-11-06 the owner changed the direction for this one-time copy. The hosted cloud database supplies the data and the local database receives it. This procedure covers the 19 business tables in the DaYo sync allowlist, including orders, menu, recipes, ingredients, archives, movements, suppliers, and staff records. Supabase login accounts and profiles, QR tokens, Storage files, deployment settings, and cloud sync metadata are outside the copy. Existing image URLs are copied with menu items. Cloud user links without the same Auth user ID in local become `NULL`. [Sync table list](../../../supabase/migrations/20261030000003_safe_cloud_sync.sql#L59) · [Sync metadata](../../../supabase/snippets/cloud_sync_local_setup.sql)

## SQL Editor steps

1. Maglaan ng maintenance window. Ihinto ang `cloud-sync` container sa Docker Desktop, maghintay ng 45 segundo, at itigil muna ang pag-edit at pagtanggap ng orders sa dalawang app. Panatilihing tumatakbo ang local Supabase. Kapag nakahinto ang worker, mawawala ang cloud QR checkout availability sa deployment na gumagamit ng heartbeat. [Availability rule](../../../supabase/migrations/20261103000000_online_ordering_availability.sql)
2. Sa **cloud SQL Editor** ng Dayo! - 2, piliin ang role `postgres` at patakbuhin ang [01 Cloud export](2026-11-06-01-cloud-export.sql). Dapat may isang result row. Tingnan ang `cloud_row_counts` at kopyahin ang buong laman ng `local_insert_sql` cell. Dapat magsimula ito sa `insert into pg_temp.dayo_cloud_snapshot`. Kung truncated ang cell o walang result, huminto. May business records sa output. Itago ito sa local machine at huwag i-paste sa chat, shared query, o repository.
3. Sa **local SQL Editor** (`localhost:54323`, role `postgres`), buksan ang [02 Local import](2026-11-06-02-local-import.sql). Palitan ang linyang `-- PASTE THE ENTIRE local_insert_sql STATEMENT HERE` ng buong kinopyang statement. Patakbuhin ang buong script sa isang Run. Kukuha ito ng private local backup sa schema na nagsisimula sa `dayo_before_cloud_import_`, papalitan ang business rows, at ibe-verify ang imported values bago mag-commit. Kapag may error, magro-roll back ang transaction. Kung column mismatch ang error, ikumpara ang schema bago ulitin.
4. Patakbuhin sa local ang verification query sa ibaba at ikumpara ang counts sa cloud export. Buksan ang Ingredients, Suppliers, at Order Summary. Panatilihing naka-stop ang `cloud-sync` hanggang ma-review ang sync ownership para sa mga susunod na edit. Ise-set aside ng import ang lumang local queue habang itinatabi ito sa backup. Hindi nito nire-reassign ang cloud record ownership.

```sql
select (select count(*) from public.ingredients) as ingredients,
       (select count(*) from public.suppliers) as suppliers,
       (select count(*) from public.orders) as orders,
       (select count(*) from public.order_items) as order_items,
       (select count(*) from public.stock_movements) as stock_movements,
       (select sum(oi.subtotal) from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.status = 'Completed') as completed_revenue,
       (select max(nspname::text) from pg_namespace
        where left(nspname::text, 25) = 'dayo_before_cloud_import_') as local_backup_schema;
```

## Verification and limits

Both scripts passed on separate PostgreSQL-compatible fixtures using the repository's business migration chain with minimal Auth and Storage stubs. The test covered copied stock and suppliers, exact large order IDs, generated subtotals, trigger restoration, private backup, stale queue retirement, and rollback on missing payload, checksum mismatch, and an external foreign key. The scripts were not run against the live cloud or local databases. The import needs compatible table columns and values on both sides. If the snapshot exceeds SQL Editor limits, use a private database dump and a scoped restore instead. [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) · [PostgreSQL TRUNCATE](https://www.postgresql.org/docs/current/sql-truncate.html)
