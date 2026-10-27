MKH VENDOR COMMISSION ADMIN INTEGRATION
=======================================

Purpose
-------
Adds a Vendor Commission & Adjustments section to the existing Admin Dashboard.
It is intended to connect the vendor commission tables/RPCs already installed in
Supabase to the Admin UI; it does not replace the vendor commission SQL migration.

What it adds
------------
1. Admin page section: vendor list, current rollout classification, latest agreement,
   allowed commission rates, policy update, new commission offer, and recent audit.
2. Server API: app/api/admin/vendor-commission/route.ts
3. Component: components/admin/VendorCommissionSettings.tsx
4. Dashboard links: desktop and mobile navigation entries.

Safety controls
---------------
- Reads and displays commission_enforcement_enabled but offers no toggle to enable it.
- Policy changes use the authenticated Admin/COO database RPC and are audited.
- Agreements are OFFERS only until each vendor explicitly accepts them.
- The interface has a confirmation dialog with Yes / No / Cancel before a policy save
  or vendor agreement offer.
- Does not change checkout code, order settlement, rider amounts, delivery fee splits,
  wallets, payout processes, or historical orders.
- The server-side service role is never sent to browser code. Mutations call the secured
  database RPC using the signed-in Admin/COO session so auth.uid() remains valid.

Prerequisites
-------------
The following SQL migrations need to have been successfully run in Supabase:
- MKH_Vendor_Sales_Commission_Migration.sql
- MKH_commission_legacy_checkout_integration.sql

The project must already have:
- lib/supabase/server.ts exporting createClient()
- lib/supabase/admin.ts exporting adminClient
- current_effective_app_role() returning ADMIN/COO for authorized profiles
- SUPABASE_SERVICE_ROLE_KEY defined server-side in .env.local

Install
-------
1. Extract this ZIP into C:\MKH\mkh-app.
   It should create C:\MKH\mkh-app\MKH_vendor_commission_admin_integration.
2. In the VS Code PowerShell terminal run:

   cd C:\MKH\mkh-app
   powershell -ExecutionPolicy Bypass -File .\MKH_vendor_commission_admin_integration\install-mkh-vendor-commission.ps1 -ProjectRoot C:\MKH\mkh-app

3. The installer will create a timestamped backup, copy the component and API, and add
   the Vendor Commission entry to desktop/mobile navigation and the existing content switch.
   It stops without writing if the expected Delivery Allocations integration anchors are missing.
4. Run:

   npm run build

5. Start the local site with npm run dev, open http://localhost:3000/admin-dashboard,
   and select Vendor Commission.

Test without enabling enforcement
---------------------------------
- Confirm enforcement displays OFF.
- Confirm the current allowed rates appear (initial policy is 5%-10% in 1% increments).
- Do not change policy unless testing explicitly; if testing policy save, select the same rates
  and use a reason such as "Admin UI connection smoke test".
- Do not send a real vendor offer as a smoke test because offers create permanent audit records.
  Use the read-only status page first; only issue an offer for an actual business action with a
  meaningful reason and intended vendor.
- Do NOT activate global commission enforcement. The vendor acceptance UI, checkout/discount
  integration, and financial reconciliation still need testing before any rollout.
- Do not push to GitHub or deploy to Vercel until the UI is reviewed and approved.
