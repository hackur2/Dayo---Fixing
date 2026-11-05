# DaYo application changelog

## 2026-11-06 — Staff login and page access (prepared)

- Staff Monitor's Add Staff form now creates a staff record together with an email/password login and a selected set of Admin pages: Kitchen Display, Order Taker, and/or Order Summary.
- Unauthorized or route-less Admin profiles are signed out at login; direct access to an unassigned Admin page is blocked. The prepared database migration also enforces KDS/order access for the selected pages.
- The Supabase migration and `create-staff-account` Edge Function must be deployed before this can be used in either database.
- [Implementation, verification, and rollout details](docs/kb/outputs/2026-11-06-staff-login-access-change.md)

## 2026-11-06 — Manual Order Taker source (prepared)

- Existing and new staff-entered orders will use `Manual Order Taker` in the database after migration. The dashboard and Order Summary recognize both spellings during rollout and show them together as Order Taker.
- [Migration, verification, and rollout details](docs/kb/outputs/2026-11-06-manual-order-taker-source-change.md)
