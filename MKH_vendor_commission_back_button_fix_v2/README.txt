MKH Vendor Commission Agreements — Back Button Fix v2

The previous installer stopped safely because the exact page-header text did not match the installed page. It made no changes.

This revised installer locates a stable content wrapper rather than relying on exact header formatting.
It adds a visible “← Back to Vendor Dashboard” link to:
  app\vendor-dashboard-v2\commission\page.tsx
The link points to /vendor-dashboard-v2.

Install:
1. Extract this ZIP into C:\MKH\mkh-app so the folder MKH_vendor_commission_back_button_fix_v2 is inside the project root.
2. Open PowerShell in the project root and run:
   powershell -ExecutionPolicy Bypass -File .\MKH_vendor_commission_back_button_fix_v2\scripts\install-mkh-vendor-commission-back-button.ps1 -ProjectRoot C:\MKH\mkh-app
3. Run npm run build.
4. Open /vendor-dashboard-v2/commission and click “Back to Vendor Dashboard”.

The script checks for the target page and exactly one known wrapper before editing. It creates a timestamped backup and touches only the page component. It does not modify APIs, database objects, agreements, payouts, or commission enforcement.
