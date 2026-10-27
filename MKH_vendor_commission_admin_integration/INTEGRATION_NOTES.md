# MKH Vendor Commission Admin Integration

This installer connects the existing vendor commission database foundation to a new Admin Dashboard section.

## Scope

- Displays global enforcement status (read-only; no enabling switch).
- Displays permitted rates (initially 5%, 6%, 7%, 8%, 9%, 10%).
- Saves policy through `mkh_set_vendor_commission_policy`, which enforces Admin/COO authorization and audit logging.
- Creates a vendor-specific offer through `mkh_offer_vendor_commission_agreement`; the offer is not effective until the vendor explicitly accepts it.
- Shows vendor status, rollout classification, latest agreement, offered/accepted status, and recent audit.
- Uses the user's authenticated session for mutating RPCs. Server-only `adminClient` is used only after Admin/COO authorization for read-only aggregate loading.

## Not included / still required before enforcement

- Vendor-side offer acceptance UI invoking `mkh_accept_vendor_commission_agreement(agreement_id)`.
- Checkout promo/discount funding integration for COD and wallet pathways.
- End-to-end verification across every order creation path.
- Commission ledger/report reconciliation and staging regression cases.

Global commission enforcement remains OFF. This bundle never changes it.
