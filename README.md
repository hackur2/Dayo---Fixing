# DaYo!

DaYo is a React/Vite ordering and inventory app backed by Supabase Postgres and Supabase Auth. The frontend contains no sample/mock datasets; empty tables render empty states and connection errors are shown instead of substituting demo records.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase project settings.
3. Run `npm run dev`.

Only the publishable key belongs in browser code. Never put the Supabase secret/service-role key in Vite variables.

## Database setup

The initial schema is `supabase/migrations/20261005000000_initial_schema.sql`. The follow-up migration `supabase/migrations/20261005010000_customer_order_rpcs.sql` adds QR-gated customer order/status/feedback RPCs, server-side menu price validation, manual POS order creation, QR token storage, and closed-by-default staff authorization. Apply these before the QR management and fixed customer QR migrations in timestamp order in the Supabase SQL Editor (or through the Supabase CLI).

Create staff through Supabase Auth. The database trigger creates an unauthorized `profiles` row. After creating the first owner account, authorize and promote it in the SQL Editor:

```sql
update public.profiles
set role = 'SUPER_ADMIN', is_authorized = true
where id = (select id from auth.users where email = 'owner@example.com');
```

New staff profiles should be explicitly authorized by a Super Admin. The browser UI does not provide account provisioning.

## Menu image storage

Apply `supabase/migrations/20261020000000_menu_image_storage.sql` in the Supabase SQL Editor. It creates or configures the public `menu-images` bucket (5 MB maximum, JPG/PNG/WebP only) and restricts uploads, updates, and deletions to authorized staff. The inventory image picker uploads selected files to this bucket and saves the resulting public URL in `menu_items.image_url`; ensure the deployed app has the same `VITE_SUPABASE_URL` and publishable key configured as your local app.

Customer QR URLs must use tokens registered in `public.qr_access_tokens`. Generate a strong random token, store only its SHA-256 hash, and place the plaintext token in the QR URL. Example SQL (replace the example token with a generated random value):

```sql
insert into public.qr_access_tokens (token_hash, label)
values (encode(extensions.digest('REPLACE_WITH_RANDOM_TOKEN', 'sha256'), 'hex'), 'Dining room QR');
```

For the fixed printable customer QR, also apply `supabase/migrations/20261006010000_create_customer_qr_session_rpc.sql`. The QR opens the customer menu directly; each scan creates a random token in this RPC and saves it in that scanning browser's four-hour local session. The legacy `/customer/access` route redirects to the menu.

The frontend sends the scanned token to RPCs; the database validates it and stores only its hash. Customer orders and feedback will fail until at least one valid token exists.

## Gemini menu assistant

For local/demo use, set `VITE_GEMINI_API_KEY` in `.env.local` and restart the app. The assistant calls Gemini directly from the browser; this exposes the key to site visitors, so restrict it to the Gemini API and your allowed website referrers. For a public production site, use a server-side function to keep the key private. The default model is `gemini-3.5-flash-lite`; on temporary overload it retries once and falls back to `gemini-3.8-flash`. `VITE_GEMINI_MODEL` can override the primary model.

## Connected modules

- Supabase Auth staff login and profile-based roles
- Customer menu and active promotions
- QR-token-validated customer order creation, status reads, and feedback (requires applying the second migration and registering a QR token)
- Admin KDS, order summary, and manual POS orders
- Super Admin inventory, dashboard, sales graph, order list, staff shifts, and feedback review

Reports are derived from the stored order and order-item rows. AI suggestions are not connected and the local fake chat has been removed.

## Real data setup

The project has no menu, ingredient, staff, promotion, or order seed data. Add your actual records through Supabase Table Editor or the application’s Super Admin inventory screens. The menu shows no items until active menu records and category relationships exist.

For the customer menu, categories are stored in `menu_categories`; `parent_id` is null for main categories and points to a main category for subcategories. Menu rows need `category_id`, `subcategory_id`, price (or variant rows), `is_active=true`, and `is_available=true`.

## Security notes

- Row Level Security is enabled in the schema migration.
- Only publishable keys are used from the browser.
- Management APIs rely on Supabase Auth and profile roles; client-side route guards are only a UI convenience.
- Customer writes go through database functions that validate QR access and compute prices from the current database menu.
- Inventory/order records are not seeded with demonstration data.
