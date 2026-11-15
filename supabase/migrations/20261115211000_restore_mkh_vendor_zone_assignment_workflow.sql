-- Restore MKH's original Admin workflow:
-- Admin creates MKH territories, creates zones under those territories,
-- and assigns vendors to the selected zone in the existing Admin dashboard.
-- Google Maps remains for vendor address verification and customer delivery
-- geocoding/road routing. No locality-to-territory coverage subsystem is needed.
--
-- This is a forward corrective migration. It removes only objects introduced
-- by 20261115170000_mkh_geography_source_of_truth. It does not change existing
-- territory, zone, vendor, location, assignment, audit, order, or financial data.

BEGIN;

-- Remove the added enforcement triggers before dropping their trigger functions.
DROP TRIGGER IF EXISTS trg_mkh_validate_vendor_zone_geography
    ON public.zone_vendors;
DROP TRIGGER IF EXISTS trg_mkh_validate_vendor_location_zone_coverage
    ON public.vendor_business_locations;

-- Remove the new administrative RPCs and the validation trigger functions.
DROP FUNCTION IF EXISTS public.mkh_admin_assign_vendor_to_zone(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.mkh_admin_set_territory_locality(uuid, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.mkh_validate_vendor_zone_geography();
DROP FUNCTION IF EXISTS public.mkh_validate_vendor_location_zone_coverage();

-- These audit tables were created exclusively for the unnecessary locality
-- coverage feature. The pre-drop check confirms both contain zero rows.
DROP TABLE IF EXISTS public.vendor_zone_assignment_audit;
DROP TABLE IF EXISTS public.territory_locality_mapping_audit;

-- Remove the feature-only index; keep the original territory_localities table
-- and all its existing rows untouched.
DROP INDEX IF EXISTS public.territory_localities_active_pair_uidx;

COMMIT;
