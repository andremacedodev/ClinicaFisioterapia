/*
  # Buckets privados, índices e RLS mais barata

  1. Buckets `patient-files` e `transaction-docs` deixam de ser públicos.
     O app passa a abrir arquivos com links assinados (createSignedUrl).
  2. Documentos financeiros ficam isolados por clínica (antes qualquer usuário
     autenticado de qualquer clínica conseguia ler).
  3. Policies passam a chamar as funções de sessão via `(select ...)`, para o
     Postgres avaliar uma vez por consulta em vez de uma vez por linha.
     As regras de acesso continuam as mesmas.
  4. Índices nas colunas usadas pelos filtros do app e pelas policies.
  5. Registro profissional (CREFITO) por profissional e empresa NFe.io por
     clínica.
*/

-- 1. Buckets privados -------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id IN ('patient-files', 'transaction-docs');

-- 2. Documentos financeiros isolados por clínica ----------------------------
-- Caminho gravado pelo app: transaction-docs/<clinic_id>/<arquivo>

ALTER POLICY "Clinic staff can view transaction docs" ON storage.objects
USING (
  bucket_id = 'transaction-docs'
  AND (storage.foldername(name))[2] = (SELECT public.current_user_clinic_id())::text
);

ALTER POLICY "Clinic staff can upload transaction docs" ON storage.objects
WITH CHECK (
  bucket_id = 'transaction-docs'
  AND (storage.foldername(name))[2] = (SELECT public.current_user_clinic_id())::text
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Clinic staff can update transaction docs" ON storage.objects
USING (
  bucket_id = 'transaction-docs'
  AND (storage.foldername(name))[2] = (SELECT public.current_user_clinic_id())::text
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  bucket_id = 'transaction-docs'
  AND (storage.foldername(name))[2] = (SELECT public.current_user_clinic_id())::text
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Clinic staff can delete transaction docs" ON storage.objects
USING (
  bucket_id = 'transaction-docs'
  AND (storage.foldername(name))[2] = (SELECT public.current_user_clinic_id())::text
  AND (SELECT public.current_user_is_admin())
);

-- 3. Policies com funções de sessão avaliadas uma vez ------------------------

ALTER POLICY "Clinic staff view all clinic appointments" ON public.appointments
USING (clinic_id = (SELECT public.current_user_clinic_id()));

ALTER POLICY "Admins create appointments" ON public.appointments
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Admins update appointments" ON public.appointments
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Admins delete appointments" ON public.appointments
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Users can view their own clinic" ON public.clinics
USING (
  owner_id = (SELECT auth.uid())
  OR id = (SELECT public.current_user_clinic_id())
);

ALTER POLICY "Users can manage evolutions in their clinic" ON public.evolutions
USING (
  EXISTS (
    SELECT 1
    FROM public.patients
    WHERE patients.id = evolutions.patient_id
      AND patients.clinic_id = (SELECT public.current_user_clinic_id())
  )
);

ALTER POLICY "Admins manage all packages and physios manage their own" ON public.lesson_packages
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND ((SELECT public.current_user_is_admin()) OR professional_id = (SELECT auth.uid()))
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND ((SELECT public.current_user_is_admin()) OR professional_id = (SELECT auth.uid()))
);

ALTER POLICY "Admins manage all installments and physios view their own" ON public.package_installments
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND EXISTS (
    SELECT 1
    FROM public.lesson_packages package_item
    WHERE package_item.id = package_installments.package_id
      AND ((SELECT public.current_user_is_admin()) OR package_item.professional_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND EXISTS (
    SELECT 1
    FROM public.lesson_packages package_item
    WHERE package_item.id = package_installments.package_id
      AND ((SELECT public.current_user_is_admin()) OR package_item.professional_id = (SELECT auth.uid()))
  )
);

ALTER POLICY "Clinic staff view patients in their clinic" ON public.patients
USING (clinic_id = (SELECT public.current_user_clinic_id()));

ALTER POLICY "Staff can create active patients and admins can create inactive" ON public.patients
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (status <> 'inativo' OR (SELECT public.current_user_is_admin()))
);

ALTER POLICY "Staff can update active patients and admins can manage inactive" ON public.patients
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (status <> 'inativo' OR (SELECT public.current_user_is_admin()))
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (status <> 'inativo' OR (SELECT public.current_user_is_admin()))
);

ALTER POLICY "Staff can delete active patients and admins can delete inactive" ON public.patients
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (status <> 'inativo' OR (SELECT public.current_user_is_admin()))
);

ALTER POLICY "Clinic users manage Pilates assessments" ON public.pilates_physiotherapy_assessments
USING (clinic_id = (SELECT public.current_user_clinic_id()))
WITH CHECK (clinic_id = (SELECT public.current_user_clinic_id()));

ALTER POLICY "Users can view profiles in their clinic" ON public.profiles
USING (
  id = (SELECT auth.uid())
  OR clinic_id = (SELECT public.current_user_clinic_id())
);

ALTER POLICY "Users can manage service invoices in their clinic" ON public.service_invoices
USING (clinic_id = (SELECT public.current_user_clinic_id()))
WITH CHECK (clinic_id = (SELECT public.current_user_clinic_id()));

ALTER POLICY "Admins can manage all clinic transactions" ON public.transactions
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

ALTER POLICY "Physios can view only their commission payments" ON public.transactions
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND NOT (SELECT public.current_user_is_admin())
  AND type = 'expense'
  AND category = 'Comissão fisioterapeuta'
  AND description ILIKE '%' || (SELECT auth.uid())::text || '%'
);

-- 4. Índices ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS profiles_clinic_id_idx
  ON public.profiles (clinic_id);
CREATE INDEX IF NOT EXISTS clinics_owner_id_idx
  ON public.clinics (owner_id);

CREATE INDEX IF NOT EXISTS patients_clinic_status_idx
  ON public.patients (clinic_id, status);
CREATE INDEX IF NOT EXISTS patients_responsible_professional_id_idx
  ON public.patients (responsible_professional_id);

CREATE INDEX IF NOT EXISTS appointments_clinic_start_time_idx
  ON public.appointments (clinic_id, start_time);
CREATE INDEX IF NOT EXISTS appointments_patient_start_time_idx
  ON public.appointments (patient_id, start_time);
CREATE INDEX IF NOT EXISTS appointments_professional_start_time_idx
  ON public.appointments (professional_id, start_time);
CREATE INDEX IF NOT EXISTS appointments_package_id_idx
  ON public.appointments (package_id);

CREATE INDEX IF NOT EXISTS evolutions_patient_created_idx
  ON public.evolutions (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evolutions_appointment_id_idx
  ON public.evolutions (appointment_id);

CREATE INDEX IF NOT EXISTS transactions_clinic_created_idx
  ON public.transactions (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_clinic_due_date_idx
  ON public.transactions (clinic_id, due_date);
CREATE INDEX IF NOT EXISTS transactions_patient_id_idx
  ON public.transactions (patient_id);

CREATE INDEX IF NOT EXISTS lesson_packages_clinic_created_idx
  ON public.lesson_packages (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lesson_packages_patient_id_idx
  ON public.lesson_packages (patient_id);
CREATE INDEX IF NOT EXISTS lesson_packages_professional_id_idx
  ON public.lesson_packages (professional_id);

CREATE INDEX IF NOT EXISTS package_installments_clinic_due_date_idx
  ON public.package_installments (clinic_id, due_date);

CREATE INDEX IF NOT EXISTS service_invoices_patient_id_idx
  ON public.service_invoices (patient_id);

CREATE INDEX IF NOT EXISTS professional_invitations_clinic_id_idx
  ON public.professional_invitations (clinic_id);
CREATE INDEX IF NOT EXISTS professional_invitations_email_idx
  ON public.professional_invitations (lower(email));

CREATE INDEX IF NOT EXISTS pilates_assessments_clinic_id_idx
  ON public.pilates_physiotherapy_assessments (clinic_id);

-- 5. Dados por profissional e por clínica -----------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_registry TEXT;

COMMENT ON COLUMN public.profiles.professional_registry IS
  'Registro profissional exibido em atestados (ex.: CREFITO 12345-F/MT).';

-- Antes o atestado preenchia este registro por nome, direto no código.
UPDATE public.profiles
SET professional_registry = '26235/MT'
WHERE professional_registry IS NULL
  AND full_name ILIKE 'cristiane carrasco%';

-- Company.Id da NFe.io de cada clínica. A Edge Function de NFS-e emite
-- sempre na empresa da clínica do usuário logado.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS nfeio_company_id TEXT;
