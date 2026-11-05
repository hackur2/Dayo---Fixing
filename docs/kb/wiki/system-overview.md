# System overview

Updated 2026-11-06. Verified against the current checkout. Human review is pending.

DaYo is a React/Vite restaurant ordering and inventory app. The frontend routes to pages and shared components, hooks manage loading and mutations, services use Supabase and RPCs, and adapters map database rows to view models. PostgreSQL owns orders, menu, inventory, promotions, staff records, feedback, and their reporting inputs. Cart, recent-order history, and QR session state in the browser support continuity. [Routes](../../../src/routes/AppRoutes.jsx) · [Supabase client](../../../src/lib/supabase.js) · [Schema baseline](../../../supabase/migrations/20261020143115_remote_schema.sql)

| Actor | Main functions | Enforcement |
| --- | --- | --- |
| Customer | Menu, cart, checkout, order status, cancellation, and feedback. | QR token validation inside order and feedback RPCs. The published menu is readable through a separate public RPC. |
| Admin | Kitchen Display System (KDS), manual POS order taking, and order summary. | Supabase Auth, an authorized profile, and staff RLS and RPC rules. |
| Super Admin | Shared KDS/POS plus dashboards, inventory, archives, suppliers, staff shifts, QR settings, and feedback review. | The Super Admin route allowlist and database role checks. |
| Sync worker | Process the local outbox and send availability heartbeats. | Server-only database credentials and a cloud service role. |

Role allowlists in the browser determine which UI a user can open. Database policies and RPCs independently check what they can read or change. Staff-directory records and shifts serve operations, while `auth.users` and `profiles` control login and authorization. [Role constants](../../../src/constants/userRoles.js) · [Route guard](../../../src/components/auth/ProtectedRoute.jsx) · [Auth service](../../../src/services/authService.js) · [Staff shift service](../../../src/services/staffShiftService.js)

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
