-- MKH customer Google Maps destination capture.
-- Applied to MKH-production as migration 20261114221350_mkh_customer_google_destination_capture.
-- Existing delivery quotes and orders are preserved.
-- Existing orders retain their existing delivery_quote_id relationships.
-- No historical records are rewritten or deleted.

BEGIN;

ALTER TABLE public.delivery_quotes
  ADD COLUMN IF NOT EXISTS destination_google_place_id text,
  ADD COLUMN IF NOT EXISTS destination_google_formatted_address text,
  ADD COLUMN IF NOT EXISTS destination_latitude double precision,
  ADD COLUMN IF NOT EXISTS destination_longitude double precision,
  ADD COLUMN IF NOT EXISTS destination_capture_method text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'delivery_quotes_destination_capture_method_ck'
       AND conrelid = 'public.delivery_quotes'::regclass
  ) THEN
    ALTER TABLE public.delivery_quotes
      ADD CONSTRAINT delivery_quotes_destination_capture_method_ck
      CHECK (
        destination_capture_method IS NULL
        OR destination_capture_method IN ('google_place', 'map_pin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'delivery_quotes_destination_coordinates_ck'
       AND conrelid = 'public.delivery_quotes'::regclass
  ) THEN
    ALTER TABLE public.delivery_quotes
      ADD CONSTRAINT delivery_quotes_destination_coordinates_ck
      CHECK (
        (
          destination_latitude IS NULL
          AND destination_longitude IS NULL
        )
        OR
        (
          destination_latitude BETWEEN 4 AND 14.5
          AND destination_longitude BETWEEN 2 AND 15.5
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'delivery_quotes_google_destination_consistency_ck'
       AND conrelid = 'public.delivery_quotes'::regclass
  ) THEN
    ALTER TABLE public.delivery_quotes
      ADD CONSTRAINT delivery_quotes_google_destination_consistency_ck
      CHECK (
        destination_capture_method IS NULL
        OR (
          destination_capture_method = 'google_place'
          AND destination_google_place_id IS NOT NULL
          AND destination_latitude IS NOT NULL
          AND destination_longitude IS NOT NULL
        )
        OR (
          destination_capture_method = 'map_pin'
          AND destination_latitude IS NOT NULL
          AND destination_longitude IS NOT NULL
        )
      );
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.delivery_quotes.destination_google_place_id IS
  'Google Maps Place ID for the customer-selected delivery destination; nullable for a coordinate-only map pin.';

COMMENT ON COLUMN public.delivery_quotes.destination_google_formatted_address IS
  'Google reverse-geocoded or Place-formatted destination address captured at quote time.';

COMMENT ON COLUMN public.delivery_quotes.destination_latitude IS
  'Server-verified customer delivery destination latitude captured from Google Maps.';

COMMENT ON COLUMN public.delivery_quotes.destination_longitude IS
  'Server-verified customer delivery destination longitude captured from Google Maps.';

COMMENT ON COLUMN public.delivery_quotes.destination_capture_method IS
  'Customer destination capture method: google_place or map_pin.';

COMMIT;