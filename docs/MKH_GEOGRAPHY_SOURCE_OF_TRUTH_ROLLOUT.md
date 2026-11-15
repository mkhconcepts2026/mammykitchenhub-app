# MKH Google Maps, customer delivery and rider GPS — Production rollout

## Approved geographical separation

**Google Maps is the source of precise address and route evidence. MKH records are the source of operational placement.**

### Vendor address verification
- Admin continues to use Google Places to find and verify a vendor's exact business premises.
- The verified Google Place ID, formatted address and coordinates are saved against the vendor's business-location record.
- The existing Admin verification safeguards remain in force: verification status, MKH locality matching for the vendor record, active MKH locality, Place ID and coordinate validation. These safeguards must not be bypassed.

### Customer delivery
- Checkout no longer asks a customer to search for or select an MKH locality or LGA.
- The customer selects a Google Maps address or confirms the precise delivery entrance with a Google Maps pin.
- Selecting the Google destination automatically requests a delivery quote.
- Google uses the vendor's Admin-verified business coordinates as the route origin and the customer's selected Google destination as the route destination.
- Google Routes calculates the driving distance. MKH applies the existing active distance-rate card, 3 km pilot limit, delivery-fee calculation and approved delivery allocation logic.
- COD and MKH Wallet checkout both validate the same Google-address-based quote hash. Quote ownership, cart hash, expiry, rate, fee and order-consumption checks remain in place.
- New quote rows leave `destination_locality_id` null. The column remains nullable for historical compatibility. Existing delivery quotes and orders are not rewritten.

### Operational placement
- Admin continues to create and maintain MKH Territories.
- Admin creates Zones under those Territories.
- Admin assigns vendors through the existing Territory → Zone vendor-assignment workflow.
- Google administrative-area labels do not create or select MKH Territories or Zones.
- There is no separate Territory Locality Mapping page in the approved workflow.

## Rider GPS and TRM live tracking

- The Rider Dashboard requests a fresh browser-device location when the dashboard is active.
- It attempts a GPS update every 15 seconds and requests another update when the browser tab becomes visible or network connectivity returns.
- The rider sees diagnostic status for permission denial, unavailable device location, offline connectivity and database write failure, with a Retry GPS action.
- A TRM rider is counted as GPS Live only when the rider account is active and a GPS row has been saved within the preceding 60 seconds.
- The map retains a stale coordinate as a last-known position, dims the marker and labels the position as last known; it is not counted as GPS Live.
- Browser GPS cannot be guaranteed while the browser or phone is suspended or the device has disabled location access. The Rider Dashboard must remain active in the foreground for continuous browser-based reporting.

## Database and data preservation

Production migration `20261115190000_mkh_google_only_customer_delivery_quotes` removes the customer-locality-only rejection from the existing COD and MKH Wallet order-creation functions. It retains their other validation logic.

Verified after migration:
- The COD and Wallet order-creation functions no longer reject a quote solely because `destination_locality_id` is null.
- The `destination_locality_id` column remains nullable.
- Existing quote and order record counts remain unchanged.
- The previous unnecessary locality-to-territory audit tables, enforcement triggers, helper functions and extra index remain absent.
- Existing territories, zones, vendor assignments, vendor-business-location records and their audit history remain preserved.

No order, quote, wallet, payment, payout, commission, delivery-allocation or settlement record was backfilled or deleted by the customer-locality correction.

## Deployment model

- **MKH-PRODUCTION** is the working database and the target for the live application.
- **MKH-PRODUCTION BACKUP** remains the separate recovery copy.
- Vercel Production at `app.mammykitchenhub.com` is the application the team uses for ongoing testing and launch preparation.
- No MKH-TEST project is required or part of this deployment model.
