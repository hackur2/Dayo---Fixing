# Ordering and access

Updated 2026-11-06. Verified against the current checkout. Human review is pending.

## Customer QR and checkout

- The printable QR opens `/customer/menu?scan=1`. The gate requests a new token from `create_customer_qr_session`, keeps it in a four-hour browser session, and strips the scan parameter. The database stores a SHA-256 hash and checks active status and any configured expiry. The fixed-scan RPC leaves database expiry unset. [QR helper](../../../src/utils/qrSessionUtils.js) · [Access gate](../../../src/components/customer/CustomerAccessGate.jsx) · [QR session and validation SQL](../../../supabase/migrations/20261020143115_remote_schema.sql#L859)
- The menu RPC is public. The app requires a QR session for customer routes, and order creation, status, cancellation, and feedback go through token-validated RPCs. The baseline identifies an existing order by its order number alongside a valid token. [Menu service](../../../src/services/menuService.js) · [Order service](../../../src/services/orderService.js) · [Feedback service](../../../src/services/feedbackService.js) · [Order status SQL](../../../supabase/migrations/20261020143115_remote_schema.sql#L1114)
- Checkout sends item and variant IDs and quantities. The RPC reads current prices from PostgreSQL and writes the order and lines together. The separate manual POS RPC validates the staff role and prices server-side. Completion triggers the recipe deductions described in the [inventory topic](inventory-and-reporting.md). [Customer order SQL](../../../supabase/migrations/20261020143115_remote_schema.sql#L721) · [POS SQL](../../../supabase/migrations/20261020143115_remote_schema.sql#L882)

## Staff order operations

KDS reads Pending, Preparing, and Ready orders from Supabase and updates order status through a protected write. The active screen refreshes via polling and realtime events. It also checks for stale Pending orders to cancel while the screen runs. Order status in the customer view refreshes from its RPC. [Order service](../../../src/services/orderService.js) · [KDS hook](../../../src/hooks/useKdsOrders.js) · [Customer status hook](../../../src/hooks/useCurrentOrderData.js)

The staff order UI uses the label `Order Taker` for manual orders. A prepared migration changes the persisted value from `Manual POS` to `Manual Order Taker`, and the dashboard and filters accept both during rollout. Applying the migration to both databases is still pending. [Naming assessment](../outputs/2026-11-06-order-taker-naming.md) · [Prepared change and rollout](../outputs/2026-11-06-manual-order-taker-source-change.md)

The Super Admin dashboard already has a role guard. A hosted deployment limited to that dashboard and the customer flow would additionally need a cloud route allowlist and database permissions that enforce the same scope. The menu RPC remains public in the current schema. [Cloud access assessment](../outputs/2026-11-06-cloud-route-access-scope.md)

## Menu images and assistant

- The picker uploads JPG, PNG, or WebP files up to 5 MiB to the public `menu-images` bucket. Inventory saves the resulting public URL in `menu_items.image_url`. Storage policies require authorized staff for writes. [Image picker](../../../src/components/superAdmin/inventory/MenuImagePicker.jsx) · [Inventory service](../../../src/services/inventoryService.js) · [Storage migration](../../../supabase/migrations/20261020143116_menu_image_storage.sql)
- The customer menu includes the Sumo Gemini assistant. The browser validates prompts in the UI and service, sends eligible menu choices, and checks returned item IDs against those choices. A configured Vite Gemini key is included in browser code. Staff-protected ingredient and recipe queries can limit what optional inventory context is available to a customer session. [Customer menu](../../../src/pages/customer/CustomerMenuPage.jsx) · [Gemini service](../../../src/services/aiAssistantService.js) · [Menu service](../../../src/services/menuService.js) · [Recipe policies](../../../supabase/migrations/20261020143115_remote_schema.sql#L1477)

## Related topics

- [System overview](system-overview.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Deployment and sync](deployment-and-sync.md)

<!-- kb:backlinks:start -->
## Backlinks

- [Deployment and sync](deployment-and-sync.md)
- [Wiki index](index.md)
- [Inventory and reporting](inventory-and-reporting.md)
- [Saved answers and wiki contributions](outputs.md)
- [System overview](system-overview.md)
<!-- kb:backlinks:end -->
