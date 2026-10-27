MKH DELIVERY ALLOCATION SETTINGS — INSTALL INTO EXISTING ADMIN DASHBOARD

This installer adds the settings to your existing Admin Dashboard. It does NOT replace the whole page and does NOT deploy or push to GitHub.

YOUR PROJECT (from the recent MKH terminal output): C:\MKH\mkh-app

STEPS
1. Download this ZIP and extract it directly into:
   C:\MKH\mkh-app
   It will create C:\MKH\mkh-app\MKH_delivery_allocation_installer\...

2. Open PowerShell and run:
   cd C:\MKH\mkh-app
   powershell -ExecutionPolicy Bypass -File .\MKH_delivery_allocation_installer\install-mkh-delivery-allocation.ps1 -ProjectRoot C:\MKH\mkh-app

   If you extracted it somewhere else, change the script path only; keep -ProjectRoot C:\MKH\mkh-app.

3. The installer checks for the existing Revenue sidebar/content anchors before saving. It creates a timestamped backup of the dashboard page and any same-path component/API files that it replaces.

4. If the installer completes, run:
   npm run build

5. Start the app locally (using your existing development command), sign in with an ADMIN or COO account, and choose:
   Admin Dashboard > Delivery Allocations

6. Confirm it shows active version 1 with base delivery fee ₦1,500, separate platform fee ₦300, and allocations ₦800 / ₦30 / ₦50 / ₦400 / ₦50 / ₦170.

IMPORTANT SAFETY NOTES
- Do not activate or change a draft while simply testing that the screen loads.
- This interface does not execute payouts, credit wallets, run settlement, or enable food-sales commission enforcement.
- The API uses SUPABASE_SERVICE_ROLE_KEY on the server only. It must not be exposed as NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY and must never be pasted into chat.
- If the installer stops because it cannot recognize a navigation/content anchor, it does not save its page edits. Send Adam the installer message and the relevant sidebar/revenue section from app\admin-dashboard\page.tsx so the patch can be adapted without replacing your current dashboard.
- This does not push to GitHub or deploy to Vercel. Review and approve the UI first.
