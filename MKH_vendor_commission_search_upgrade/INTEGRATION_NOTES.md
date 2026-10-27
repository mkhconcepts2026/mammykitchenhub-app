# MKH Vendor Commission & Adjustments — Server-Side Vendor Search Upgrade

## What changed

- Replaced the all-vendors dropdown with a search-as-you-type active-vendor picker.
- Search checks vendor name and email using a case-insensitive substring match. For example, `ma` returns matching active vendors such as Mama's Kitchen; adding more text narrows the results.
- Results are loaded server-side in pages of 20. Match counts and Previous/Next controls allow browsing every matching result without loading thousands of records into the browser.
- Added search and pagination to the Vendor Commission Status table as well.
- The main settings request no longer downloads up to 1,000 vendor rows and hundreds of agreements on every page load. It loads only summary counts, settings, and a bounded audit list.
- The offer API independently verifies the selected vendor is still active before creating an offer.

## Safety preserved

- Commission enforcement stays OFF; this screen contains no switch to turn it on.
- Existing Yes / No / Cancel confirmation for policy saves and vendor offers remains.
- Only Admin/COO callers can access the route.
- Commission offers still require vendor acceptance before they become effective.
- No checkout, settlement, payout, wallet, delivery-fee split, or database schema was changed.
- The service-role key is never sent to the browser.

## Install the upgrade

1. Extract this ZIP into `C:\MKH\mkh-app`. It creates `C:\MKH\mkh-app\MKH_vendor_commission_search_upgrade`.
2. In the VS Code PowerShell terminal run:

   ```powershell
   cd C:\MKH\mkh-app
   powershell -ExecutionPolicy Bypass -File .\MKH_vendor_commission_search_upgrade\install-mkh-vendor-commission-search.ps1 -ProjectRoot C:\MKH\mkh-app
   ```

3. The installer requires the previously installed Vendor Commission component and API route. It creates a timestamped backup, replaces only those two files, and rolls back both if installation fails. It does not modify the dashboard page.
4. Run `npm run build`.
5. Start the app locally and open Admin Dashboard → Vendor Commission.

## Local test

- In **Find active vendor**, type `ma`. The results should show the count of active matches and up to 20 results per page.
- Type more of the name, for example `mama's kitchen`, to narrow the list. Select the intended result before reviewing an offer.
- In **Vendor commission status**, test the same kind of search and paging across all vendors.
- Search for one character to see the prompt to enter at least two characters; clear the search to browse from the first page.
- Do not create an offer solely as a test because offers are permanent audited business records.
- Do not enable commission enforcement. Do not push to GitHub or deploy until the interface is reviewed and approved.
