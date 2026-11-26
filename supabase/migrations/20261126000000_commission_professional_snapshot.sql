/*
  # Comissão fica com quem era a responsável na data da aula

  Problema: o relatório de comissão atribui cada aula à fisioterapeuta
  responsável ATUAL do paciente. Ao trocar a responsável (por exemplo ao
  inativar uma fisioterapeuta e transferir os pacientes para outra), todas as
  aulas já dadas desses pacientes passavam a contar para a nova, inclusive
  meses anteriores e comissões já pagas.

  Correção:
  1. appointments.commission_professional_id: quem recebe a comissão daquela
     aula. Vazio = regra de antes (responsável atual do paciente), então nada
     muda nos relatórios já existentes.
     Sem chave estrangeira de propósito: uma segunda ligação appointments →
     profiles deixaria ambíguas as consultas atuais que usam "profiles (...)".
  2. Gatilho em patients: quando a responsável do paciente muda, as aulas que
     já aconteceram (start_time < agora) e ainda não têm o campo preenchido
     ficam gravadas com a responsável ANTERIOR. Aulas futuras seguem a nova.
     Vale para a transferência na inativação (deactivate_professional) e para
     a troca manual no cadastro do paciente.
  3. O campo só é gravado pelo gatilho (ou pelo SQL do painel): o app não
     pode alterá-lo.
*/

-- 1. Coluna -------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS commission_professional_id UUID;

COMMENT ON COLUMN public.appointments.commission_professional_id IS
  'Profissional que recebe a comissão desta aula. Vazio = responsável atual do paciente. Gravado automaticamente quando a responsável do paciente muda.';

CREATE INDEX IF NOT EXISTS appointments_commission_professional_id_idx
  ON public.appointments (commission_professional_id)
  WHERE commission_professional_id IS NOT NULL;

-- 2. Gatilho na troca de responsável ------------------------------------------
CREATE OR REPLACE FUNCTION public.keep_past_commission_with_previous_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsible_professional_id IS DISTINCT FROM OLD.responsible_professional_id THEN
    UPDATE public.appointments a
    SET commission_professional_id = COALESCE(OLD.responsible_professional_id, a.professional_id)
    WHERE a.patient_id = NEW.id
      AND a.start_time < now()
      AND a.commission_professional_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_past_commission_with_previous_responsible() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_past_commission_with_previous_responsible_trigger ON public.patients;
CREATE TRIGGER keep_past_commission_with_previous_responsible_trigger
  AFTER UPDATE OF responsible_professional_id ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_past_commission_with_previous_responsible();

-- 3. O app não altera o campo -------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_appointment_commission_professional()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
    (TG_OP = 'INSERT' AND NEW.commission_professional_id IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.commission_professional_id IS DISTINCT FROM OLD.commission_professional_id)
  ) THEN
    RAISE EXCEPTION 'A profissional da comissão da aula é definida automaticamente pelo sistema.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_appointment_commission_professional_trigger ON public.appointments;
CREATE TRIGGER protect_appointment_commission_professional_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_appointment_commission_professional();
