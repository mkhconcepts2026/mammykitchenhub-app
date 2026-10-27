MKH VENDOR COMMISSION SEARCH UPGRADE
====================================

This is an upgrade to the already-installed Vendor Commission screen. It implements the requested server-side search so the UI does not load 5,000 vendor options into a dropdown.

Extract this ZIP into C:\MKH\mkh-app. Then run this from VS Code PowerShell:

  cd C:\MKH\mkh-app
  powershell -ExecutionPolicy Bypass -File .\MKH_vendor_commission_search_upgrade\install-mkh-vendor-commission-search.ps1 -ProjectRoot C:\MKH\mkh-app

The installer backs up and replaces only:
  components\admin\VendorCommissionSettings.tsx
  app\api\admin\vendor-commission\route.ts

It does not alter the dashboard page, database, checkout, settlement, payouts, wallets, delivery-fee allocations, or enforcement flag. It requires the previous Vendor Commission integration to exist and rolls back if installation fails.

Then run:
  npm run build

Test by typing "ma" under Find active vendor. Matching results are fetched from the server in pages of 20; the status table also has server-side search and pagination. Do not create test commission offers and do not enable commission enforcement.
