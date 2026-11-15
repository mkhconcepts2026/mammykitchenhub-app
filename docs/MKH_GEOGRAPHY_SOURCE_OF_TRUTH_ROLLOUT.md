# MKH geography source-of-truth separation

## Approved operating rule

- Google Maps supplies exact street-address evidence for vendor business-location verification.
- Google Maps geocoding and Routes are used to resolve the customer's delivery street and calculate road distance.
- MKH's own active locality, LGA, territory, and zone records determine operational coverage and vendor placement.
- Google's locality and administrative-area labels are hints only. They do not create or select an MKH territory.
- Financial allocations, delivery charges, vendor/rider commissions, wallet balances, payout eligibility, and settlement workflows are outside this change.

## Current production baseline reviewed (read-only, 15 November 2026)

The read-only review found:

| Record set | Current count |
|---|---:|
| Active MKH localities | 274 |
| Active territories | 19 |
| Active zones | 1 |
| Active locality-to-territory links | 0 |
| Active vendor-to-zone assignments | 6 |
| Vendor business-location records | 12 |
| Vendor business-location audit entries | 12 |

The six active vendor-zone assignments all had an existing verified/matched MKH locality and their current territory was in the same LGA. There were no explicit active territory_localities links, so the database does not currently contain enough MKH coverage data to prove which individual locality belongs to which operational territory. Multiple territories share the same LGA. **Do not infer a territory from LGA alone and do not bulk-populate the links from Google labels.**

Existing assignments and location history are not rewritten by this change.

## New Admin workflow

1. Admin/COO verifies the vendor's precise business address using the existing Google Places verification process.
2. Admin/COO explicitly matches the premises to an active MKH locality. The Google locality text remains a hint, not the selection authority.
3. Admin/COO opens **Admin → Vendor Business Locations → Manage MKH Territory Coverage** and maps that locality to one or more MKH territories from the same LGA. A reason is mandatory and the action is audited.
4. Admin/COO assigns the vendor to an active zone within one of the territories explicitly mapped to the vendor's verified MKH locality. A reason is mandatory and the assignment is audited.
5. If a vendor's verified locality changes, the new locality must cover the vendor's current active territory. Otherwise the verified change is rejected until the coverage/assignment is reconciled. A pending address update remains possible and continues to block delivery quotes under the existing safeguards.

A locality can be linked to more than one territory where the MKH operational boundary requires it. The application does not infer this relationship automatically.

## Database protections added by the migration

- Prevent duplicate active links for the same locality/territory pair, while retaining the existing many-to-many model.
- Preserve removed mapping links as inactive history rather than deleting them.
- Add append-only audit records for territory-locality coverage and vendor-zone changes, including actor and reason.
- Validate active locality, territory, zone, same-LGA relationship, and explicit MKH coverage when an active vendor-zone assignment is created or reactivated.
- Keep the existing vendor address-verification and MKH locality-match checks as prerequisites.
- Prevent a newly verified locality from contradicting an existing active vendor-zone assignment.
- Keep Admin/COO writes behind server-side authorization and service-role RPC calls; browser clients do not write the audit tables.

## Files in this change

- supabase/migrations/20261115170000_mkh_geography_source_of_truth.sql
- app/api/admin/territory-locality-mappings/route.ts
- app/api/admin/vendor-zone-assignment/route.ts
- app/admin-dashboard/territory-locality-mapping/page.tsx
- app/admin-dashboard/page.tsx (vendor-zone assignment UI)
- app/admin-dashboard/vendor-locations/page.tsx (coverage-management link)

## TEST-first validation plan

Apply the migration to MKH-TEST only after the SQL and API review. Do not apply it to MKH-PRODUCTION as part of this feature-branch work.

1. Confirm the two audit tables, partial unique index, RPC functions, and triggers exist in MKH-TEST.
2. Confirm all 274 active localities and all 19 active territories load in the coverage manager.
3. Map one known locality to a territory from the same LGA; confirm the reason and actor are written to the audit table.
4. Attempt a locality-to-territory link across different LGAs; it must fail and write no active link.
5. Assign a test vendor whose address is verified and locality matched to a zone in an explicitly mapped territory; confirm the new active assignment and audit record.
6. Attempt assignment to a zone in an unmapped territory; it must fail.
7. Attempt assignment when the business address is pending/rejected or the MKH locality is pending/inactive; it must fail.
8. Attempt to remove a coverage link used by an active vendor assignment; it must fail.
9. Attempt to verify a changed locality that does not cover the vendor's existing zone territory; it must fail without replacing the prior verified record.
10. Reassign a test vendor between valid zones; confirm the old zone_vendors row remains with status inactive and unassigned_at, the new row is active, and the assignment audit is recorded.
11. Confirm the customer delivery-quote flow still uses the selected MKH customer locality and Google street geocoding/Routes for distance. Check its quote amounts against the existing approved rate card; this change must not alter any financial calculation.

## Deployment boundary

This branch is based on security/vendor-bank-encryption-rollout-preview-20261113. It does not merge into the production branch, apply SQL to any Supabase project, or deploy to Vercel. Production rollout requires a separate approval after MKH-TEST validation.
