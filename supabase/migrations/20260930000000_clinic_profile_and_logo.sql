/*
  # Dados cadastrais e logo da clínica

  Campos opcionais usados no cabeçalho de atestados e recibos. O logo fica no
  bucket público `clinic-assets`, em `<clinic_id>/<arquivo>`; só quem criou a
  clínica pode enviar, trocar ou remover.
*/

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_district TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

-- Logos não são dados sensíveis e precisam carregar nas janelas de impressão.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-assets',
  'clinic-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Clinic members can view clinic assets" ON storage.objects;
CREATE POLICY "Clinic members can view clinic assets" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinic-assets'
  AND (storage.foldername(name))[1] = (SELECT public.current_user_clinic_id())::text
);

DROP POLICY IF EXISTS "Clinic owners can upload clinic assets" ON storage.objects;
CREATE POLICY "Clinic owners can upload clinic assets" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinic-assets'
  AND EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id::text = (storage.foldername(objects.name))[1]
      AND clinics.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Clinic owners can update clinic assets" ON storage.objects;
CREATE POLICY "Clinic owners can update clinic assets" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinic-assets'
  AND EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id::text = (storage.foldername(objects.name))[1]
      AND clinics.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'clinic-assets'
  AND EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id::text = (storage.foldername(objects.name))[1]
      AND clinics.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Clinic owners can delete clinic assets" ON storage.objects;
CREATE POLICY "Clinic owners can delete clinic assets" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinic-assets'
  AND EXISTS (
    SELECT 1
    FROM public.clinics
    WHERE clinics.id::text = (storage.foldername(objects.name))[1]
      AND clinics.owner_id = (SELECT auth.uid())
  )
);
