/*
  # Inativação de profissionais

  1. `profiles` ganha `active`, `deactivated_at` e `deactivated_by`.
     Profissional inativado continua no banco: agendamentos, evoluções,
     avaliações e comissões antigas seguem com o nome dele.

  2. `current_user_clinic_id()` e `current_user_is_admin()` passam a considerar
     só perfis ativos. Como todas as policies da clínica dependem dessas duas
     funções, o profissional inativado perde acesso a todos os dados da
     clínica na hora, mesmo com sessão aberta. Ele continua lendo apenas a
     própria linha em `profiles` (para o app mostrar "acesso desativado").

  3. Correção de segurança: antes, qualquer usuário podia alterar o próprio
     `role` (virar admin), `clinic_id` e agora `active`. Um trigger bloqueia
     essas colunas em updates feitos direto pela API. Só as funções abaixo
     (SECURITY DEFINER) ou o SQL do painel do Supabase podem alterá-las.

  4. Funções para a tela Equipe (somente admin):
     - professional_pending_summary(id): agendamentos futuros, pacientes sob
       responsabilidade e pacotes ativos do profissional.
     - deactivate_professional(id, reassign_to): inativa e, se informado,
       transfere esses itens para outro profissional, tudo na mesma transação.
     - reactivate_professional(id).
*/

-- 1. Colunas -------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active IS
  'false = profissional inativado: sem acesso aos dados da clínica, mas mantido no histórico.';

CREATE INDEX IF NOT EXISTS profiles_clinic_active_idx
  ON public.profiles (clinic_id, active);

-- 2. Funções de sessão só reconhecem perfis ativos -----------------------------

CREATE OR REPLACE FUNCTION public.current_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND active
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
      AND active
    LIMIT 1
  ), false)
$$;

-- O convite (professional_invitations) tinha uma checagem própria de admin
-- direto em profiles; passa a usar a função, que já exige perfil ativo.
DROP POLICY IF EXISTS "Admins can manage professional invitations" ON public.professional_invitations;
CREATE POLICY "Admins can manage professional invitations" ON public.professional_invitations
FOR ALL
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

-- 3. Colunas protegidas em profiles ---------------------------------------------
-- Requisições do app chegam como os papéis `authenticated`/`anon`. Funções
-- SECURITY DEFINER e o SQL do painel rodam como dono (postgres) e passam.

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
    OR NEW.active IS DISTINCT FROM OLD.active
    OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
    OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
  ) THEN
    RAISE EXCEPTION 'Função, clínica e status do profissional só podem ser alterados pela administradora na tela Equipe.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_columns_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_columns();

-- Perfis novos (cadastro da clínica ou convite) sempre nascem ativos.
CREATE OR REPLACE FUNCTION public.force_new_profile_active()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.active := true;
    NEW.deactivated_at := NULL;
    NEW.deactivated_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_new_profile_active_trigger ON public.profiles;
CREATE TRIGGER force_new_profile_active_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.force_new_profile_active();

-- 4. Funções da tela Equipe -----------------------------------------------------

-- Valida que quem chama é admin ativo e que o alvo é da mesma clínica.
-- Retorna o clinic_id da clínica.
CREATE OR REPLACE FUNCTION public.assert_admin_can_manage_professional(p_professional_id UUID)
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
    RAISE EXCEPTION 'Somente a administradora pode gerenciar a equipe.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_professional_id AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'Profissional não encontrado nesta clínica.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_clinic_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.professional_pending_summary(p_professional_id UUID)
RETURNS TABLE (
  future_appointments INTEGER,
  responsible_patients INTEGER,
  active_packages INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.assert_admin_can_manage_professional(p_professional_id);
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.appointments a
      WHERE a.clinic_id = v_clinic_id
        AND a.professional_id = p_professional_id
        AND a.start_time >= now()
        AND a.status IN ('agendada', 'confirmada', 'reposicao')),
    (SELECT count(*)::int FROM public.patients pt
      WHERE pt.clinic_id = v_clinic_id
        AND pt.responsible_professional_id = p_professional_id
        AND pt.status NOT IN ('inativo', 'encerrado')),
    (SELECT count(*)::int FROM public.lesson_packages lp
      WHERE lp.clinic_id = v_clinic_id
        AND lp.professional_id = p_professional_id
        AND lp.status = 'ativo');
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_professional(
  p_professional_id UUID,
  p_reassign_to UUID DEFAULT NULL
)
RETURNS TABLE (
  moved_appointments INTEGER,
  moved_patients INTEGER,
  moved_packages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.assert_admin_can_manage_professional(p_professional_id);
  v_appointments INTEGER := 0;
  v_patients INTEGER := 0;
  v_packages INTEGER := 0;
BEGIN
  IF p_professional_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode inativar o seu próprio acesso.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = v_clinic_id AND owner_id = p_professional_id
  ) THEN
    RAISE EXCEPTION 'A dona da clínica não pode ser inativada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_professional_id AND active
  ) THEN
    RAISE EXCEPTION 'Este profissional já está inativo.';
  END IF;

  IF p_reassign_to IS NOT NULL THEN
    IF p_reassign_to = p_professional_id THEN
      RAISE EXCEPTION 'Escolha outro profissional para receber os atendimentos.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_reassign_to
        AND clinic_id = v_clinic_id
        AND active
        AND role IN ('admin', 'physio')
    ) THEN
      RAISE EXCEPTION 'O profissional escolhido para receber os atendimentos não está ativo nesta clínica.';
    END IF;

    UPDATE public.appointments
    SET professional_id = p_reassign_to
    WHERE clinic_id = v_clinic_id
      AND professional_id = p_professional_id
      AND start_time >= now()
      AND status IN ('agendada', 'confirmada', 'reposicao');
    GET DIAGNOSTICS v_appointments = ROW_COUNT;

    UPDATE public.patients
    SET responsible_professional_id = p_reassign_to
    WHERE clinic_id = v_clinic_id
      AND responsible_professional_id = p_professional_id
      AND status NOT IN ('inativo', 'encerrado');
    GET DIAGNOSTICS v_patients = ROW_COUNT;

    UPDATE public.lesson_packages
    SET professional_id = p_reassign_to
    WHERE clinic_id = v_clinic_id
      AND professional_id = p_professional_id
      AND status = 'ativo';
    GET DIAGNOSTICS v_packages = ROW_COUNT;
  END IF;

  UPDATE public.profiles
  SET active = false,
      deactivated_at = now(),
      deactivated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_professional_id;

  RETURN QUERY SELECT v_appointments, v_patients, v_packages;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_professional(p_professional_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin_can_manage_professional(p_professional_id);

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_professional_id AND active
  ) THEN
    RAISE EXCEPTION 'Este profissional já está ativo.';
  END IF;

  UPDATE public.profiles
  SET active = true,
      deactivated_at = NULL,
      deactivated_by = NULL,
      updated_at = now()
  WHERE id = p_professional_id;
END;
$$;

-- O Supabase concede EXECUTE em funções novas para anon/authenticated por
-- padrão; a função auxiliar fica restrita ao uso interno.
REVOKE ALL ON FUNCTION public.assert_admin_can_manage_professional(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.professional_pending_summary(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_professional(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_professional(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.professional_pending_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_professional(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_professional(UUID) TO authenticated;
