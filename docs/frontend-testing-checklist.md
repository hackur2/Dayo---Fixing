# Frontend Verification Checklist

This checklist is a plan to execute; it is not a claim that checks passed.

## Supabase setup

- [ ] Apply `20261005000000_initial_schema.sql` and `20261005010000_customer_order_rpcs.sql` in order.
- [ ] Configure `.env.local` with the project URL and publishable key only.
- [ ] Create an Auth owner and promote/authorize its profile.
- [ ] Register an active QR token.
- [ ] Add actual menu categories, items, variants, ingredients, and recipe requirements.

## Customer

- [ ] Confirm menu requests load rows from Supabase and empty tables show an empty state.
- [ ] Confirm an unregistered QR token cannot place an order.
- [ ] Confirm a registered token can place an order and database prices determine the total.
- [ ] Confirm order status is fetched from Supabase and completed orders can submit feedback.

## Admin and Super Admin

- [ ] Confirm unauthorized users cannot read protected data through PostgREST.
- [ ] Confirm KDS status updates persist and appear in Order Summary.
- [ ] Confirm manual POS persists orders and validates prices server-side.
- [ ] Confirm inventory, dashboard, sales graph, staff shifts, and feedback read/write real rows.
- [ ] Confirm failed network requests show errors without displaying substitute records.
