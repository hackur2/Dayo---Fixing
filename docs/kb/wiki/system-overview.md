# System overview

Updated 2026-11-06. Verified against the current checkout. Human review is pending.

DaYo is a React/Vite restaurant ordering and inventory app. The frontend routes to pages and shared components, hooks manage loading and mutations, services use Supabase and RPCs, and adapters map database rows to view models. PostgreSQL owns orders, menu, inventory, promotions, staff records, feedback, and their reporting inputs. Cart, recent-order history, and QR session state in the browser support continuity. [Routes](../../../src/routes/AppRoutes.jsx) · [Supabase client](../../../src/lib/supabase.js) · [Schema baseline](../../../supabase/migrations/20261020143115_remote_schema.sql)

| Actor | Main functions | Enforcement |
| --- | --- | --- |
| Customer | Menu, cart, checkout, order status, cancellation, and feedback. | QR token validation inside order and feedback RPCs. The published menu is readable through a separate public RPC. |
| Admin | Kitchen Display System (KDS), manual POS order taking, and order summary. | Supabase Auth, an authorized profile, and staff RLS and RPC rules. |
| Super Admin | Shared KDS/POS plus dashboards, inventory, archives, suppliers, staff shifts, QR settings, and feedback review. | The Super Admin route allowlist and database role checks. |
| Sync worker | Process the local outbox and send availability heartbeats. | Server-only database credentials and a cloud service role. |

Staff Monitor provisioning is prepared to create an Auth user, authorized profile, staff record, and first shift together through a Super Admin-only Edge Function. An Admin profile stores the selected Admin routes; login and route guards fail closed for profiles without a permitted route, while the migration separately restricts order reads, KDS updates, and manual order creation. This is not deployed until the migration and Edge Function are applied. [Provisioning report](../outputs/2026-11-06-staff-login-access-change.md) · [Edge Function](../../../supabase/functions/create-staff-account/index.ts) · [Access migration](../../../supabase/migrations/20261106000001_staff_login_access.sql)

The customer cloud build and the local Docker build can connect to different Supabase databases. A separate worker mirrors a defined subset of business records. Auth users, profiles, QR tokens and Storage objects are outside the outbound mirror. [Deployment flag](../../../src/config/deployment.js) · [Worker runbook](../../../sync/README.md)

## Related topics

- [Ordering and access](ordering-and-access.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Deployment and sync](deployment-and-sync.md)
- [Verification and source map](verification.md)

<!-- kb:backlinks:start -->
## Backlinks

- [Deployment and sync](deployment-and-sync.md)
- [Wiki index](index.md)
- [Ordering and access](ordering-and-access.md)
- [Saved answers and wiki contributions](outputs.md)
- [Verification and source map](verification.md)
<!-- kb:backlinks:end -->
