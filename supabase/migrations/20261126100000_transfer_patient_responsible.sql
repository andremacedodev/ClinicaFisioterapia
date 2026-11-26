/*
  # Trocar a fisioterapeuta responsável de UM paciente

  Usado pela tela Pacientes → Editar paciente (somente administradora).

  Regra (a mesma da inativação com transferência):
  - O paciente passa a ter a nova fisioterapeuta como responsável.
  - As aulas DESTE paciente com a fisioterapeuta anterior, do momento da
    troca em diante (agendada, confirmada ou reposição), passam para a nova.
  - Os pacotes ativos deste paciente que estavam com a anterior passam para a nova.
  - Aulas que já aconteceram não mudam: continuam no histórico e na comissão
    de quem deu a aula. Aulas futuras com outra profissional também não mudam.

  Funções:
  - patient_transfer_summary(paciente): o que vai mudar (para o aviso na tela)
  - transfer_patient_responsible(paciente, nova): faz a troca de uma vez
*/

CREATE OR REPLACE FUNCTION public.assert_admin_can_manage_patient(p_patient_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.current_user_clinic_id();
BEGIN
  IF v_clinic_id IS NULL OR NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente a administradora pode trocar a fisioterapeuta responsável.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients WHERE id = p_patient_id AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Paciente não encontrado nesta clínica.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.patient_transfer_summary(p_patient_id UUID)
RETURNS TABLE (
  current_professional_id UUID,
  future_appointments INTEGER,
  active_packages INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.assert_admin_can_manage_patient(p_patient_id);
  v_current UUID;
BEGIN
  SELECT responsible_professional_id INTO v_current
  FROM public.patients WHERE id = p_patient_id;

  RETURN QUERY
  SELECT
    v_current,
    (SELECT count(*)::int FROM public.appointments a
      WHERE a.clinic_id = v_clinic_id
        AND a.patient_id = p_patient_id
        AND v_current IS NOT NULL
        AND a.professional_id = v_current
        AND a.start_time >= now()
        AND a.status IN ('agendada', 'confirmada', 'reposicao')),
    (SELECT count(*)::int FROM public.lesson_packages lp
      WHERE lp.clinic_id = v_clinic_id
        AND lp.patient_id = p_patient_id
        AND v_current IS NOT NULL
        AND lp.professional_id = v_current
        AND lp.status = 'ativo');
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_patient_responsible(
  p_patient_id UUID,
  p_new_professional_id UUID
)
RETURNS TABLE (
  moved_appointments INTEGER,
  moved_packages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.assert_admin_can_manage_patient(p_patient_id);
  v_current UUID;
  v_appointments INTEGER := 0;
  v_packages INTEGER := 0;
BEGIN
  IF p_new_professional_id IS NULL THEN
    RAISE EXCEPTION 'Escolha a nova fisioterapeuta responsável.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_new_professional_id
      AND clinic_id = v_clinic_id
      AND active
      AND role IN ('admin', 'physio')
  ) THEN
    RAISE EXCEPTION 'A fisioterapeuta escolhida não está ativa nesta clínica.';
  END IF;

  -- Trava a linha do paciente para duas trocas simultâneas não se cruzarem.
  SELECT responsible_professional_id INTO v_current
  FROM public.patients WHERE id = p_patient_id
  FOR UPDATE;

  IF v_current IS NOT DISTINCT FROM p_new_professional_id THEN
    RAISE EXCEPTION 'Esta fisioterapeuta já é a responsável por este paciente.';
  END IF;

  IF v_current IS NOT NULL THEN
    UPDATE public.appointments
    SET professional_id = p_new_professional_id
    WHERE clinic_id = v_clinic_id
      AND patient_id = p_patient_id
      AND professional_id = v_current
      AND start_time >= now()
      AND status IN ('agendada', 'confirmada', 'reposicao');
    GET DIAGNOSTICS v_appointments = ROW_COUNT;

    UPDATE public.lesson_packages
    SET professional_id = p_new_professional_id
    WHERE clinic_id = v_clinic_id
      AND patient_id = p_patient_id
      AND professional_id = v_current
      AND status = 'ativo';
    GET DIAGNOSTICS v_packages = ROW_COUNT;
  END IF;

  UPDATE public.patients
  SET responsible_professional_id = p_new_professional_id
  WHERE id = p_patient_id;

  RETURN QUERY SELECT v_appointments, v_packages;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_admin_can_manage_patient(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.patient_transfer_summary(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_patient_responsible(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.patient_transfer_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_patient_responsible(UUID, UUID) TO authenticated;
