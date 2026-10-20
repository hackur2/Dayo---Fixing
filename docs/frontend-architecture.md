# Frontend Architecture

The React/Vite app uses Supabase Auth and Supabase Postgres through `@supabase/supabase-js`.

## Data flow

```text
Page → hook → service → Supabase client → Postgres/RLS or database RPC
```

- `src/pages/`: customer, Admin, and Super Admin screens.
- `src/components/`: shared UI and feature components.
- `src/hooks/`: loading, error, and action state for pages.
- `src/services/`: Supabase queries and RPC calls.
- `src/adapters/`: map database records to UI models and create request payloads.
- `src/lib/supabase.js`: browser client initialized from Vite environment variables.
- `supabase/migrations/`: schema and secured database functions.

The frontend has no sample/mock data modules or sample-mode switches. Empty tables produce empty UI states; failed requests produce visible errors.

## Supabase security boundary

The browser uses only the publishable key. Supabase Auth identifies management users; `profiles.role` and `profiles.is_authorized` drive role checks, while RLS protects the database. Client route guards are a UI convenience, not the security boundary.

Customer ordering and feedback use database RPCs with a registered QR token. The order function resolves menu/variant prices from Postgres and creates order/order-item rows in one transaction. Manual POS also uses a role-checked RPC.

## Data ownership

Postgres is the source of truth for menu, orders, inventory, promotions, staff, feedback, and reporting. Cart and the active order may be cached in local storage for page continuity. A one-time startup cleanup removes pre-Supabase browser demo records.

## Current limitations

- The database has no business seed data; add actual menu/catalog/inventory records before expecting populated screens.
- QR tokens are managed in Supabase SQL Editor and must be registered before customer order/feedback RPCs succeed.
- The AI suggestion chat was removed because it returned local fabricated responses. AI suggestions need a real server-side provider integration.
- Menu image selection currently stores a data URL. Supabase Storage upload support is still needed for production-sized images.
