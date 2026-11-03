# DaYo!

DaYo is a React/Vite ordering and inventory app backed by Supabase Postgres and Supabase Auth. Operational tables render empty states and connection errors instead of substituting demo records. The Supplier directory is accessed through Inventory and reads, adds, edits, and deletes records in `public.suppliers` through the existing Supabase connection. Supplier IDs are assigned by the database and displayed as `SUP-001`, `SUP-002`, etc. The table requires the Supplier SQL setup and an authorized Super Admin session. Previous browser-only supplier records are not automatically imported into the database.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase project settings.
3. Run `npm run dev`.

## Run with Docker

The included Docker image serves the production Vite build with Nginx. The app container is separate from Supabase: point it at the public API URL and publishable key of your Supabase instance. For a self-hosted Supabase deployment, use the official Supabase Docker Compose setup on your server, then apply this repository's SQL migrations to that instance.

1. Copy `.env.docker.example` to `.env.docker` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use the public URL that browsers can reach (including HTTPS when exposed to the internet); do not use the service-role/secret key.
2. Start the app with `docker compose --env-file .env.docker up -d --build`.
3. Open `http://localhost:8080` (or the port set by `DAYO_PORT`).

The `VITE_*` values are embedded in the browser bundle during the image build. Rebuild the image after changing them. If Supabase is on another server or behind a proxy, configure its allowed origins/CORS and Auth site URL/redirect URLs for the frontend's public origin. Do not expose Supabase's database or service-role credentials to the browser.

## Run the local app and Supabase stack with Docker

The Supabase CLI runs the local Supabase services in Docker, including Postgres, Auth, Storage, and the API. The Dayo frontend runs in the separate `dayo` container above. Both stay on this computer and the database data is kept in Docker volumes.

1. Start the local Supabase stack from this project folder: `npx supabase start`.
2. In another PowerShell window, run `npx supabase status` and copy its API URL and publishable/anon key.
3. Copy `docker/.env.docker.local.example` to `docker/.env.docker.local`. Set the URL and key from step 2. For access from other devices, use this computer's LAN IP in the URL, such as `http://192.168.1.20:54321`.
4. From the repository root, start Dayo with `docker compose -f docker/docker-compose.yml --env-file docker/.env.docker.local up -d --build`.
5. On this computer, open `http://localhost:8080`. Other devices should open `http://<server-LAN-IP>:8080`.

The core schema is captured in `supabase/migrations/20261020143115_remote_schema.sql`. The data-only cloud export in `supabase/seed.sql` is local and ignored by Git. The dashboard-controlled sync outbox is installed from `supabase/snippets/cloud_sync_local_setup.sql` after the data seed. `supabase/local_sync.sql` is retained as the legacy setup and is not the current seed entry point.

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

### Ingredient Archive

Run `supabase/snippets/ingredient_archive_setup.sql` in the Supabase SQL Editor to enable Archive beside the Ingredients and Menu Items buttons. The same setup is versioned in migrations `20261028000000_ingredient_archive.sql` and `20261028000001_archive_cloud_sync.sql`. Ingredient deletion keeps a complete snapshot and deletion timestamp in the same transaction. Recipe and stock-history protections still apply. The browser blocks ingredient deletion if archive setup is missing. Records deleted before capture was installed cannot be reconstructed by this feature.

For local-to-cloud mirror installations, run the setup on both databases. Existing local outbox setups are updated automatically; fresh setups include archives in `supabase/local_sync.sql`. Archive rows mirror once, and cloud-side ingredient removals do not create duplicate archive entries.

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

The Sumo AI input checks English and Filipino profanity while typing or pasting and shows **Watch your language**. Send is disabled while the warning is present, and the AI service validates the prompt again before issuing a request. The configured vocabulary handles common case, Unicode, repeated-letter, spacing, punctuation, masking, and number/symbol variants. Whole-word checks and food phrase exceptions preserve requests for puto, boba tea, leche flan, and other ordinary menu terms. These checks run in the browser; the existing customer-name, notes, and feedback validation rules are separate.

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

## Local-first mode and cloud mirror

The Dashboard's **Sync to Cloud** button queues a protected request in the local database. The server-side `cloud-sync` service processes manual requests and also retries queued changes every five minutes. Inventory, menu records and recipes, stock transactions, orders, order items (sales), and other supported business records are captured transactionally. The dashboard shows confirmed and failed record counts, records awaiting sync, and the last successful cloud confirmation.

To enable the cloud mirror:

1. Apply the same business schema migrations on both databases, including the existing mirror guards in `20261020150000_local_cloud_sync.sql` and the receiver in `20261030000003_safe_cloud_sync.sql`. The receiver disables the legacy overwrite/delete RPC.
2. Stop the old sync worker and apply `supabase/snippets/cloud_sync_local_setup.sql` **only on the local database**. It preserves the existing queue and captures a one-time baseline of current rows, including records created before capture was installed. Re-running it does not duplicate the baseline.
3. In `docker/.env.docker.local`, set `CLOUD_SUPABASE_URL` to the cloud API URL and `CLOUD_SUPABASE_SERVICE_ROLE_KEY` to the cloud service-role/secret key. This key stays in the server-side sync worker; never put it in a `VITE_*` variable. The frontend must point to the local Supabase API.
4. From the repository root, rebuild the app and worker: `docker compose -f docker/docker-compose.yml --env-file docker/.env.docker.local up -d --build`.

### Docker-controlled online ordering

`20261103000000_online_ordering_availability.sql` adds a fail-closed availability check for customer QR orders. Apply it to **both** the local and cloud databases, then re-run `supabase/snippets/cloud_sync_local_setup.sql` on the local database to add the local Dashboard control.

The Docker build sets `VITE_DEPLOYMENT_MODE=local`, so only the local Super Admin Dashboard shows the **Online ordering** ON/OFF control. A Vercel build defaults to cloud mode and never renders that control. The local sync worker reports the manual setting and a heartbeat to the cloud every five seconds. A cloud customer order is accepted only if the switch is ON and the last heartbeat is newer than 45 seconds. Stopping Docker, turning off the local computer, losing internet access, or failing to configure the worker therefore closes Vercel ordering automatically. The cloud database enforces this rule even when a caller bypasses the customer UI.

#### Apply all SQL with one command

For a new local database, run `npm run db:local:reset`. It starts local Supabase and applies every migration plus the local-only sync setup. **It deletes and recreates the local database**, so do not use it when local records must be retained.

For cloud, link the project once with `npx supabase link --project-ref YOUR_PROJECT_REF`, then run `npm run db:cloud:push`. Supabase applies all versioned migrations in filename order; it does not run the local-only `cloud_sync_local_setup.sql` snippet on cloud.

Each local transaction is saved in one cloud transaction. IDs, composite keys, persisted batch IDs, and cloud receipts prevent duplicates when a response is lost. Records are marked synced locally only after a matching cloud confirmation. New edits during an upload remain pending. Newer or independently changed cloud records cause a conflict; the entire affected batch remains queued and local data stays intact. Cloud records are never deleted by synchronization, including when a row is removed locally. Cloud edits are not pulled into the local database or silently merged.

See [sync/README.md](sync/README.md) for conflict rules, installation, recovery, and testing. Local Auth users, profiles, QR tokens, and Storage files are excluded. Cloud-specific user references are retained on updates; new mirrored rows use null references when local identities do not exist in the cloud. The local Supabase CLI stack is for development; use the official self-hosted Supabase Docker Compose deployment for a permanent production server.
