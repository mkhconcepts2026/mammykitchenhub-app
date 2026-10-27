MKH Vendor Commission Agreements — Back Button patch

Purpose
Adds a visible “← Back to Vendor Dashboard” link at the top of the Commission Agreements page.
The link navigates to /vendor-dashboard-v2.

Install
1. Extract this ZIP into C:\MKH\mkh-app, so the folder MKH_vendor_commission_back_button is created in the project root.
2. Open PowerShell at the project root and run:

   powershell -ExecutionPolicy Bypass -File .\MKH_vendor_commission_back_button\scripts\install-mkh-vendor-commission-back-button.ps1 -ProjectRoot C:\MKH\mkh-app

3. Run npm run build.
4. Visit http://localhost:3000/vendor-dashboard-v2/commission and confirm the link navigates back to the vendor dashboard.

The installer backs up only app\vendor-dashboard-v2\commission\page.tsx under _mkh_integration_backups.
It does not change API routes, database schema, commission agreements, payouts, or enforcement.
