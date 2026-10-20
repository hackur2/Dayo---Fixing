# Authentication and Role Routing

Management login uses Supabase Auth email/password. On successful sign-in, the frontend reads the matching `profiles` row and accepts only an authorized `ADMIN` or `SUPER_ADMIN` role.

Supabase RLS is the access-control boundary. Route guards and local cached profile data only control which screens are shown; every protected database operation also requires an authenticated JWT and permitted profile role.

New Auth users receive a profile with `is_authorized=false`. A Super Admin must explicitly authorize them. Bootstrap the first owner using the SQL documented in `README.md`.

Customer routes use QR tokens, not management accounts. The browser stores the scanned token for convenience, while Postgres hashes and validates it for customer order and feedback RPCs.
