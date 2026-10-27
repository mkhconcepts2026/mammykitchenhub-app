# MKH Vendor Commission Agreement Acceptance — Integration Package

## Included
- `app/vendor-dashboard-v2/commission/page.tsx`: vendor-facing commission offer review, explicit accept confirmation, decline reason capture, and status history.
- `app/api/vendor/commission-agreements/route.ts`: authenticated vendor-scoped API to read only the signed-in profile's linked vendor agreements and submit accept/decline through database RPCs.
- `sql/MKH_vendor_commission_decline_migration.sql`: adds the `declined` status and a guarded, auditable `mkh_decline_vendor_commission_agreement` RPC. This is required for the Decline button.
- `scripts/install-mkh-vendor-agreement-acceptance.ps1`: creates a timestamped backup, installs the new page/API and adds a menu link to the existing vendor sidebar. It stops rather than overwrite if the target page/API files already exist.

## Important safety properties
- Existing `mkh_accept_vendor_commission_agreement` is invoked through the signed-in Supabase server client so `auth.uid()` remains the vendor user. The existing database function verifies that the active profile is linked to the requested vendor and that the agreement belongs to that vendor.
- Vendor data is queried by `profiles.vendor_id` on the server; the browser does not get a service-role key and cannot request another vendor's agreements.
- Decline requires an explicit reason (at least five characters) and writes an audit record. Only agreements still in `offered` status can be declined.
- Accept requires a confirmation modal and an acknowledgement checkbox. Decline requires a reason and a separate confirmation.
- No code in this package toggles `vendor_commission_settings.commission_enforcement_enabled`, alters checkout, changes historical orders, settles orders, or moves funds.
- The page is a structured offer review based on the fields currently stored in `terms_snapshot`; it warns vendors to review any separate full agreement text supplied by MKH. This package does not invent full legal terms.

## Apply in order
1. In Supabase SQL Editor, run `sql/MKH_vendor_commission_decline_migration.sql` after confirming the prior vendor commission migrations are installed. The migration is narrowly scoped to allowing and auditing declined offers. It never turns on global enforcement.
2. Extract the ZIP into `C:\MKH\mkh-app`. It will create `C:\MKH\mkh-app\MKH_vendor_agreement_acceptance`.
3. In VS Code PowerShell:
   ```powershell
   cd C:\MKH\mkh-app
   powershell -ExecutionPolicy Bypass -File .\MKH_vendor_agreement_acceptance\scripts\install-mkh-vendor-agreement-acceptance.ps1 -ProjectRoot C:\MKH\mkh-app
   ```
4. Run `npm run build` from the project root.
5. Verify `/vendor-dashboard-v2/commission` while signed in using a dedicated test vendor profile. Check unauthorized users are denied, only that vendor's agreements appear, and the enforcement indicator says OFF.
6. Do not use a real offer for acceptance testing. Use a clearly designated test vendor and test-only agreement if a functional accept/decline test is approved. Acceptance and decline produce durable audit records, so canceling a UI modal is the only no-write test.

## Current limits / follow-up
- The page lists the latest 50 agreement records. If a vendor can accumulate more than 50, add server-side pagination.
- The current commission table stores a structured `terms_snapshot`, not a full contract document. Before treating this as the complete legal agreement experience, MKH should confirm the wording and storage/attachment of approved vendor terms.
- Checkout snapshots and promo discount funding still require independent integration/regression verification before commission enforcement is ever enabled.
