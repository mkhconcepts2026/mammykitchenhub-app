# MKH-Production rider-policy test reset checkpoint

**Checkpoint:** `MKH-PROD-RIDER-TEST-RESET-2026-11-17T185254Z`  
**Captured:** 17 November 2026, 18:52:54 UTC  
**Environment:** MKH-Production  
**Supabase project ref:** `ujjxnexhuuekrbrnnwcg`  
**Application repository:** `mkhconcepts2026/mammykitchenhub-app`  
**Pinned source commit:** `bb9b8f94195418afa43b378a36a1ddad2b655630`  
**Production URL:** https://app.mammykitchenhub.com

## Reset carried out

Eight pre-launch rider-policy test orders assigned to John Stones were closed as **cancelled test orders**, not falsely recorded as delivered:

- MKH-000103
- MKH-000104
- MKH-000106
- MKH-000107
- MKH-000108
- MKH-000115
- MKH-000119
- MKH-000121

Two wallet-paid orders (MKH-000119 and MKH-000121) were refunded to the original customer's MKH Wallet using two explicit `refund` transactions totalling **NGN 37,000**. Their payment status is `refunded`. Six unpaid COD test orders remain unpaid and cancelled. All eight order rows, original rider/vendor links, and financial allocation snapshots were retained. Each order has an append-only `test_order_closed` event.

No rider earnings, vendor transactions, beneficiary payout postings or completed financial-ledger postings were created for these test orders.

## Rider starting configuration

John Stones now has:
- Permanent home zone: Maryland Zone.
- Verified active vendor coverage: Gina Drinks.
- Initial dispatch availability: `unavailable`.
- Active orders/offers: zero at checkpoint time.

He must open the Rider Dashboard, refresh GPS within the approved 60-second freshness window, and switch to Available before the dispatcher can offer a pickup.

## Data stamp

See `DATA-STAMP.json` for migration versions, aggregate row counts and schema/function fingerprints.

## Backup scope and limitations

This is a GitHub source checkpoint anchored to the exact current `main` commit plus a non-sensitive data stamp. It is **not a full database export or restore point**.

Per MKH owner instruction, the separate `MKH-PRODUCTION BACKUP` project was not changed. Its encrypted database refresh and restore verification remain deferred until formal go-live preparation.

No customer PII, bank details, wallet balances, Paystack recipient codes, API secrets or encryption keys are included in this checkpoint.
