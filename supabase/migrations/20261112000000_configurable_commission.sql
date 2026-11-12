/*
  # Comissão configurável por profissional

  Antes: 40% fixo no código.
  Agora: cada profissional tem regras de comissão (porcentagem do valor da
  aula OU valor fixo por aula), cada uma valendo a partir de um momento.
  Uma alteração vale para as aulas a partir do momento em que foi feita;
  aulas anteriores continuam com a regra antiga.

  1. clinics.default_commission_type / default_commission_value
     Padrão da clínica, usado para profissionais novos. Clínicas existentes
     ficam com 40%.

  2. professional_invitations.commission_type / commission_value
     Comissão escolhida no convite (opcional; vazio = padrão da clínica).

  3. professional_commission_rules
     Histórico de regras. Todos os profissionais existentes recebem 40%
     valendo desde sempre, então nenhum valor já calculado muda.
     Profissionais novos recebem uma regra automaticamente ao entrar.

  4. Funções (somente admin):
     - set_professional_commission(profissional, tipo, valor)
     - set_clinic_default_commission(tipo, valor)

  A comissão digitada manualmente em uma aula (appointments.commission_amount)
  continua tendo prioridade sobre a regra.
*/

-- 1. Padrão da clínica -----------------------------------------------------------

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS default_commission_type TEXT NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS default_commission_value NUMERIC(12,2) NOT NULL DEFAULT 40;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinics_default_commission_check') THEN
    ALTER TABLE public.clinics ADD CONSTRAINT clinics_default_commission_check CHECK (
      default_commission_type IN ('percent', 'fixed')
      AND default_commission_value >= 0
      AND (default_commission_type <> 'percent' OR default_commission_value <= 100)
    );
  END IF;
END $$;

-- 2. Comissão no convite ---------------------------------------------------------

ALTER TABLE public.professional_invitations
  ADD COLUMN IF NOT EXISTS commission_type TEXT,
  ADD COLUMN IF NOT EXISTS commission_value NUMERIC(12,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'professional_invitations_commission_check') THEN
    ALTER TABLE public.professional_invitations ADD CONSTRAINT professional_invitations_commission_check CHECK (
      (commission_type IS NULL AND commission_value IS NULL)
      OR (
        commission_type IN ('percent', 'fixed')
        AND commission_value >= 0
        AND (commission_type <> 'percent' OR commission_value <= 100)
      )
    );
  END IF;
END $$;

-- 3. Regras por profissional -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.professional_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_commission_rules_value_check CHECK (
    commission_type IN ('percent', 'fixed')
    AND commission_value >= 0
    AND (commission_type <> 'percent' OR commission_value <= 100)
  )
);

COMMENT ON TABLE public.professional_commission_rules IS
  'Histórico da comissão de cada profissional. Para uma aula, vale a regra com o maior valid_from <= início da aula.';

CREATE INDEX IF NOT EXISTS professional_commission_rules_professional_idx
  ON public.professional_commission_rules (professional_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS professional_commission_rules_clinic_idx
  ON public.professional_commission_rules (clinic_id);

ALTER TABLE public.professional_commission_rules ENABLE ROW LEVEL SECURITY;

-- Admin vê as regras da clínica; fisioterapeuta vê só as dela.
-- Gravação apenas pelas funções abaixo.
DROP POLICY IF EXISTS "Clinic can view commission rules" ON public.professional_commission_rules;
CREATE POLICY "Clinic can view commission rules" ON public.professional_commission_rules
FOR SELECT
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (
    (SELECT public.current_user_is_admin())
    OR professional_id = (SELECT auth.uid())
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.professional_commission_rules FROM anon, authenticated;

-- Profissionais existentes: padrão da clínica (40%) valendo desde sempre.
INSERT INTO public.professional_commission_rules
  (clinic_id, professional_id, commission_type, commission_value, valid_from)
SELECT p.clinic_id, p.id, c.default_commission_type, c.default_commission_value, '1900-01-01T00:00:00Z'
FROM public.profiles p
JOIN public.clinics c ON c.id = p.clinic_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.professional_commission_rules r WHERE r.professional_id = p.id
);

-- Profissional novo: comissão do convite, ou o padrão da clínica.
CREATE OR REPLACE FUNCTION public.create_initial_commission_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_value NUMERIC(12,2);
BEGIN
  IF NEW.clinic_id IS NULL OR EXISTS (
    SELECT 1 FROM public.professional_commission_rules WHERE professional_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT i.commission_type, i.commission_value
  INTO v_type, v_value
  FROM public.professional_invitations i
  JOIN auth.users u ON lower(u.email) = lower(i.email)
  WHERE u.id = NEW.id
    AND i.clinic_id = NEW.clinic_id
    AND i.commission_type IS NOT NULL
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_type IS NULL THEN
    SELECT default_commission_type, default_commission_value
    INTO v_type, v_value
    FROM public.clinics
    WHERE id = NEW.clinic_id;
  END IF;

  INSERT INTO public.professional_commission_rules
    (clinic_id, professional_id, commission_type, commission_value, valid_from)
  VALUES
    (NEW.clinic_id, NEW.id, COALESCE(v_type, 'percent'), COALESCE(v_value, 40), '1900-01-01T00:00:00Z');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_initial_commission_rule_trigger ON public.profiles;
CREATE TRIGGER create_initial_commission_rule_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_initial_commission_rule();

-- 4. Funções da administração ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_commission(p_type TEXT, p_value NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_type IS NULL OR p_type NOT IN ('percent', 'fixed') THEN
    RAISE EXCEPTION 'Tipo de comissão inválido: use porcentagem ou valor fixo.';
  END IF;
  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'O valor da comissão não pode ser negativo.';
  END IF;
  IF p_type = 'percent' AND p_value > 100 THEN
    RAISE EXCEPTION 'A porcentagem de comissão não pode passar de 100%%.';
  END IF;
END;
$$;

-- Nova regra para o profissional, valendo a partir de agora.
CREATE OR REPLACE FUNCTION public.set_professional_commission(
  p_professional_id UUID,
  p_type TEXT,
  p_value NUMERIC
)
RETURNS public.professional_commission_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.assert_admin_can_manage_professional(p_professional_id);
  v_rule public.professional_commission_rules;
BEGIN
  PERFORM public.validate_commission(p_type, p_value);

  INSERT INTO public.professional_commission_rules
    (clinic_id, professional_id, commission_type, commission_value, valid_from, created_by)
  VALUES
    (v_clinic_id, p_professional_id, p_type, round(p_value, 2), now(), auth.uid())
  RETURNING * INTO v_rule;

  RETURN v_rule;
END;
$$;

-- Padrão da clínica (só afeta profissionais que entrarem depois).
CREATE OR REPLACE FUNCTION public.set_clinic_default_commission(p_type TEXT, p_value NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.current_user_clinic_id();
BEGIN
  IF v_clinic_id IS NULL OR NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente a administradora pode alterar a comissão padrão.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.validate_commission(p_type, p_value);

  UPDATE public.clinics
  SET default_commission_type = p_type,
      default_commission_value = round(p_value, 2)
  WHERE id = v_clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_initial_commission_rule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_professional_commission(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_clinic_default_commission(TEXT, NUMERIC) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_professional_commission(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_clinic_default_commission(TEXT, NUMERIC) TO authenticated;
