# MKH distance-based rider payout and residual surcharge — TEST checkpoint

Date: 2026-11-06
Environment: MKH TEST only. This document records a completed test; it is not approval to deploy or migrate Production.

## Verified order
- Order ID: `a5e20ade-cb6f-4f08-ad9b-ee6d79ee1449`
- Order status: delivered
- Payment status: paid (TEST COD)
- Verified road distance: 2.316 km
- Customer food subtotal: NGN 9,000
- Customer delivery fee: NGN 1,900
- Separate platform fee: NGN 300
- Customer order total: NGN 11,200

## Captured delivery-fee allocation
- Rider payout: NGN 1,000 (base NGN 800 + distance increment NGN 200)
- TRM: NGN 30
- ZM: NGN 50
- VHA: NGN 170
- MKH main: NGN 400
- SG Global Alliance: NGN 50
- Fixed non-rider sharing: NGN 700
- Residual distance surcharge: NGN 200
- Customer delivery fee reconciliation: NGN 1,000 + NGN 700 + NGN 200 = NGN 1,900

## Verified settlement evidence
- Five fixed beneficiary postings were posted: NGN 700 total.
- Core rider earning ledger: NGN 1,000, completed.
- One matching `rider_earnings` row exists for this order: NGN 1,000, pending (normal Monday availability cycle).
- Funded rider increment allocation row was posted once.
- MKH surcharge posting: NGN 200, posted.
- Surcharge wallet balance reported after this order: NGN 600, lifetime earnings NGN 600 (includes prior TEST credit; not a claim about live funds).
- Delivery revenue ledger: NGN 900, reconciling to NGN 700 fixed sharing + NGN 200 residual surcharge.
- No external bank transfer was initiated.

## SQL archive handling
The 2026-11-04 quote-backed checkout SQL includes COD and additional customer Wallet/Paystack routines. It is kept under `database/review-only` because Wallet/Paystack end-to-end tests are not complete. Do not move it into `supabase/migrations` or apply it to Production until separately reviewed and approved.

The 2026-11-06 distance-rider and constraint SQL files are TEST-applied review records. Production migration and deployment remain separate approval steps.