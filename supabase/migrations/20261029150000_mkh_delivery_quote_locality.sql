-- MKH Stage 1.1: attach the selected active MKH locality to new delivery quotes.
-- Additive-only. Existing delivery_quotes rows remain NULL and untouched.
-- No orders, payment RPCs, wallets, allocation ledgers, payouts, or settlement functions change.
-- Apply to MKH TEST only after reviewing.

BEGIN;

ALTER TABLE public.delivery_quotes
  ADD COLUMN IF NOT EXISTS destination_locality_id uuid;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_quotes_destination_locality_fk'
      AND conrelid = 'public.delivery_quotes'::regclass
  ) THEN
    ALTER TABLE public.delivery_quotes
      ADD CONSTRAINT delivery_quotes_destination_locality_fk
      FOREIGN KEY (destination_locality_id)
      REFERENCES public.localities(id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS delivery_quotes_destination_locality_idx
  ON public.delivery_quotes(destination_locality_id, created_at DESC);

COMMIT;

-- Read-only verification after applying in MKH TEST:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='delivery_quotes'
--   AND column_name='destination_locality_id';
-- SELECT conname FROM pg_constraint
-- WHERE conrelid='public.delivery_quotes'::regclass
--   AND conname='delivery_quotes_destination_locality_fk';
