MKH DELIVERY ALLOCATION — CONFIRMATION FAILSAFE PATCH

WHAT THIS PATCH DOES
- Shows a custom "Are you sure?" confirmation dialog before Save Draft.
- Shows a custom "Are you sure?" confirmation dialog before Activate Version.
- Each dialog has explicit Yes, No, and Cancel choices.
- Cancel closes the dialog without performing the action and keeps current form values.
- On Save Draft, "No, discard edits" restores values from the last saved draft without saving current form edits.
- On Activate Version, "No, keep draft" declines activation and leaves the draft unactivated.
- Yes runs the selected action after existing validation checks.

INSTALL
1. Extract this entire ZIP into C:\MKH\mkh-app.
2. In VS Code PowerShell, run:

   cd C:\MKH\mkh-app
   powershell -ExecutionPolicy Bypass -File .\MKH_delivery_allocation_confirmation_failsafe\install-mkh-allocation-confirmation.ps1 -ProjectRoot C:\MKH\mkh-app

3. After the installer reports success, run:

   npm run build

4. Start the local site and test both buttons. Do NOT activate a version just to test; open the confirmation dialog and choose Cancel or No.

SAFETY
- Creates a timestamped backup of components\admin\DeliveryAllocationSettings.tsx.
- Replaces only that component; it does not alter the dashboard page, API route, Supabase database, payouts, wallets, settlement functions, or commission enforcement.
- Does not push to GitHub or deploy to Vercel.
- No allocation version is activated by installing this patch.
