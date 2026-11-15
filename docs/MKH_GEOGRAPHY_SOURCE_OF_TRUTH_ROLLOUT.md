# MKH geography and operational placement — corrected implementation

## Approved MKH design

The agreed separation is:

- **Google Maps** verifies the vendor's precise business address and supplies reliable coordinates.
- **Google Maps Geocoding and Routes** resolve the customer's delivery address and calculate the road route/distance from the vendor's verified coordinates to the customer's delivery coordinates.
- **MKH records** remain the operational source of truth for where a vendor is placed: Admin selects an existing MKH Territory and then a Zone belonging to that Territory.
- Google locality or administrative-area labels must never create, select, or override an MKH Territory or Zone.

## Existing Admin workflow retained

MKH already has these Admin modules:

1. **Territory Management** — Admin creates and manages territories, including their LGA.
2. **Zone Management** — Admin creates and manages zones under the selected territory.
3. **Vendor assignment** — Admin opens the existing vendor assignment workflow, selects a Territory, selects an active Zone under that Territory, and assigns the vendor.

There is no separate locality-to-territory coverage administration page in the approved workflow.

## Corrective action

The feature branch briefly introduced a new locality-to-territory mapping page, dedicated APIs, and database triggers/RPCs requiring an explicit locality coverage link before a vendor could be assigned to a zone. This was an unnecessary additional workflow and was not part of the approved design.

The feature page, navigation link, and feature-specific APIs have been removed. The existing Admin dashboard and Vendor Business Locations page have been restored from the pre-feature security branch.

A forward corrective migration, `20261115211000_restore_mkh_vendor_zone_assignment_workflow.sql`, removes only the functions, triggers, audit tables and unique index that were introduced for the unnecessary feature. It preserves the original `territory_localities` table and all existing operational records.

## Data preservation boundaries

The corrective migration does not update or delete:

- MKH localities, LGAs, territories or zones;
- existing vendor-zone assignment rows or assignment history;
- vendor business-location rows or address verification audit history;
- customer orders, payment records, wallets, commissions, allocation ledgers, payouts or settlement records.

The two temporary audit tables were verified empty before removal.

## Deployment/testing

The Vercel Preview branch continues to use MKH-PRODUCTION as the working database, per the approved MKH development model. The MKH-PRODUCTION BACKUP remains the separate recovery copy. No MKH-TEST project is part of this plan.

After the corrective migration is applied, verify that:
- both temporary geography triggers and their helper functions are gone;
- Admin Territory Management and Zone Management remain available;
- the existing Admin vendor assignment modal can again select an active Territory and an active Zone under it;
- Google Maps vendor address verification and customer delivery geocoding/Routes remain unchanged.
