# Staff login and page access change

## Request

When a Super Admin adds a staff member from Staff Monitor, create that person's profile/login at the same time, allow the Super Admin to select only the pages the person may open, and block an unauthorized account from the staff portal.

## Prepared implementation

The Add Staff dialog now requires a login email, a temporary password of at least eight characters, and at least one selected Admin page. It calls the `create-staff-account` Edge Function rather than exposing a service-role key in the browser. The function verifies that its caller is an authorized Super Admin, creates the Auth user, authorizes its profile, stores the page list, and creates linked `staff` and first `staff_shifts` records.

The prepared migration adds `profiles.allowed_routes`, preserves all three Admin pages for already-authorized Admin profiles, and fails closed for new profiles with no selected pages. It makes direct route checks use the stored route list and restricts the Order Taker RPC, KDS updates, and order reads to the corresponding assigned pages. A login with an unauthorized or route-less Admin profile is signed out and shown as blocked.

## Verification

- `node --test tests/authRouteUtils.test.mjs` passed: 2 tests covering an assigned Admin page, blocked direct route, fallback redirect, and Super Admin routes.
- `npm.cmd run build` passed.
- `git diff --check` passed.
- No database reset, migration application, Edge Function deployment, browser session, or cloud deployment was performed.

## Rollout required

1. Apply `20261106000001_staff_login_access.sql` to the intended Supabase database(s).
2. Deploy the `create-staff-account` Edge Function with Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`; never put that value in a Vite environment variable.
3. Deploy the frontend, sign in as a Super Admin, create a test staff account, and verify that its selected page opens while an unselected direct URL is rejected.

## Evidence

- [Add Staff modal](../../../src/components/superAdmin/staff/AddStaffModal.jsx)
- [Staff provisioning service](../../../src/services/staffShiftService.js)
- [Edge Function](../../../supabase/functions/create-staff-account/index.ts)
- [Access migration](../../../supabase/migrations/20261106000001_staff_login_access.sql)
- [Route guard](../../../src/components/auth/ProtectedRoute.jsx)
- [Route tests](../../../tests/authRouteUtils.test.mjs)
