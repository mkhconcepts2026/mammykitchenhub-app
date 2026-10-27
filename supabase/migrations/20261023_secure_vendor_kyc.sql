-- MKH KYC privacy migration candidate.
-- IMPORTANT: First run scripts/migrate-vendor-kitchen-images.mjs --apply and
-- confirm it completes. This SQL intentionally aborts if any nonempty
-- kitchen_photo_url still points at the old vendor-documents bucket.
-- No storage objects or application/KYC rows are deleted by this migration.

BEGIN;

-- Fail early if the source buckets are not present.
DO $$
BEGIN
  IF (
    SELECT COUNT(*) FROM storage.buckets
    WHERE id IN ('vendor-documents', 'kyc-documents')
  ) <> 2 THEN
    RAISE EXCEPTION 'KYC migration stopped: vendor-documents and kyc-documents buckets must both exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vendor_applications
    WHERE NULLIF(BTRIM(kitchen_photo_url), '') IS NOT NULL
      AND kitchen_photo_url NOT ILIKE '%/object/public/vendor-kitchen-images/%'
      AND kitchen_photo_url NOT ILIKE '%/object/sign/vendor-kitchen-images/%'
  ) THEN
    RAISE EXCEPTION 'KYC migration stopped: at least one kitchen photo reference has not been migrated to vendor-kitchen-images. Run the migration helper first and review its report.';
  END IF;
END $$;

-- Audit columns only; existing status and document-reference values are preserved.
ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS kyc_review_notes text;

ALTER TABLE public.vendor_kyc
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Public kitchen imagery has its own bucket. Existing sensitive-document
-- objects remain in place but become private when their original buckets do.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-kitchen-images',
  'vendor-kitchen-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    ]::text[]
WHERE id IN ('vendor-documents', 'kyc-documents');

-- Remove previous policies tied to these buckets, including permissive public
-- SELECT/UPDATE/DELETE policies. Unrelated menu/employee-photo policies remain.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%vendor-documents%'
        OR COALESCE(with_check, '') ILIKE '%vendor-documents%'
        OR COALESCE(qual, '') ILIKE '%kyc-documents%'
        OR COALESCE(with_check, '') ILIKE '%kyc-documents%'
        OR COALESCE(qual, '') ILIKE '%vendor-kitchen-images%'
        OR COALESCE(with_check, '') ILIKE '%vendor-kitchen-images%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Browser onboarding remains compatible with the current pre-auth form, but
-- private identity buckets permit only INSERT into expected document folders.
-- Bucket limits above restrict accepted MIME types and maximum size.
CREATE POLICY vendor_documents_onboarding_insert_only
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND split_part(name, '/', 1) IN ('cac', 'ids', 'selfies')
);

CREATE POLICY kyc_documents_vendor_insert_only
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND split_part(name, '/', 1) IN ('cac', 'id', 'selfie')
);

-- Kitchen photos are upload-file content intended for display, not identity data.
-- The bucket is public for image display; client policies grant INSERT only.
CREATE POLICY vendor_kitchen_images_onboarding_insert_only
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'vendor-kitchen-images'
  AND split_part(name, '/', 1) = 'kitchens'
);

-- Verify storage properties and absence of policies that could allow client
-- reads, edits or deletions from the private identity buckets. Abort/rollback if
-- a broad policy would still permit such access.
DO $$
BEGIN
  IF (
    SELECT COUNT(*) FROM storage.buckets
    WHERE id IN ('vendor-documents', 'kyc-documents') AND public = false
  ) <> 2 THEN
    RAISE EXCEPTION 'KYC migration check failed: both identity buckets must be private.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'vendor_documents_onboarding_insert_only' AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'kyc_documents_vendor_insert_only' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'KYC migration check failed: expected identity upload policies are missing.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'storage'
      AND p.tablename = 'objects'
      AND p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
      AND (
        COALESCE(p.qual, '') ILIKE '%vendor-documents%'
        OR COALESCE(p.with_check, '') ILIKE '%vendor-documents%'
        OR COALESCE(p.qual, '') ILIKE '%kyc-documents%'
        OR COALESCE(p.with_check, '') ILIKE '%kyc-documents%'
        OR (
          p.roles && ARRAY['public', 'anon', 'authenticated']::name[]
          AND (
            p.qual IS NULL
            OR LOWER(BTRIM(p.qual)) = 'true'
            OR p.qual NOT ILIKE '%bucket_id%'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'KYC migration check failed: an applicable broad client read/update/delete policy remains on storage.objects.';
  END IF;
END $$;

COMMIT;
