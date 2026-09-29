/*
  # Pagamentos de comissão com período de referência

  Antes, o pagamento de comissão era só uma despesa com a data do pagamento e
  o nome do profissional na descrição. O relatório procurava despesas dentro
  do período pelo texto, então:
  - comissão de março paga em 05/04 continuava "a pagar" em março e era
    descontada de abril;
  - pagamento para "Ana Paula" também contava para "Ana".

  Agora cada pagamento guarda profissional, período de referência, valor e
  data do pagamento. A despesa continua existindo (caixa, extrato) e fica
  ligada ao pagamento; excluir a despesa exclui o pagamento.

  Pagamentos antigos são migrados como referentes ao mês em que foram pagos
  (os números exibidos continuam iguais) e ficam marcados para revisão.
*/

CREATE TABLE IF NOT EXISTS public.commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_at DATE NOT NULL,
  transaction_id UUID UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS commission_payments_clinic_professional_period_idx
  ON public.commission_payments (clinic_id, professional_id, period_start);

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage clinic commission payments" ON public.commission_payments;
CREATE POLICY "Admins manage clinic commission payments" ON public.commission_payments
FOR ALL
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND (SELECT public.current_user_is_admin())
);

DROP POLICY IF EXISTS "Professionals view their own commission payments" ON public.commission_payments;
CREATE POLICY "Professionals view their own commission payments" ON public.commission_payments
FOR SELECT
USING (
  clinic_id = (SELECT public.current_user_clinic_id())
  AND professional_id = (SELECT auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;

-- Registra despesa + pagamento juntos (ou nenhum dos dois).
-- SECURITY INVOKER: valem as mesmas regras de acesso do usuário.
CREATE OR REPLACE FUNCTION public.register_commission_payment(
  p_professional_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_amount NUMERIC,
  p_paid_at DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID := public.current_user_clinic_id();
  v_professional_name TEXT;
  v_transaction_id UUID;
  v_payment_id UUID;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente administradores registram pagamento de comissão.';
  END IF;

  SELECT full_name INTO v_professional_name
  FROM public.profiles
  WHERE id = p_professional_id AND clinic_id = v_clinic_id;

  IF v_professional_name IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado nesta clínica.';
  END IF;

  INSERT INTO public.transactions (clinic_id, amount, type, category, status, description, due_date)
  VALUES (
    v_clinic_id,
    p_amount,
    'expense',
    'Comissão fisioterapeuta',
    'paid',
    format(
      'Pagamento de comissão para %s (%s) - referente a %s a %s',
      v_professional_name,
      p_professional_id,
      to_char(p_period_start, 'DD/MM/YYYY'),
      to_char(p_period_end, 'DD/MM/YYYY')
    ),
    p_paid_at
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.commission_payments (
    clinic_id, professional_id, period_start, period_end, amount, paid_at, transaction_id
  )
  VALUES (
    v_clinic_id, p_professional_id, p_period_start, p_period_end, p_amount, p_paid_at, v_transaction_id
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_commission_payment(UUID, DATE, DATE, NUMERIC, DATE) TO authenticated;

-- Pagamentos antigos. Profissional, nesta ordem:
--   1. ID entre parênteses na descrição;
--   2. descrição exatamente "Pagamento de comissão para <nome>" (nome único);
--   3. a única profissional cujo nome ou ID aparece na descrição (a mesma
--      regra que o relatório usava; se aparecer mais de uma, não migra).
INSERT INTO public.commission_payments (
  clinic_id, professional_id, period_start, period_end, amount, paid_at, transaction_id, needs_review, created_at
)
SELECT
  t.clinic_id,
  matched.professional_id,
  date_trunc('month', t.due_date)::date,
  (date_trunc('month', t.due_date) + interval '1 month - 1 day')::date,
  t.amount,
  t.due_date,
  t.id,
  true,
  t.created_at
FROM public.transactions t
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (
      SELECT p.id
      FROM public.profiles p
      WHERE p.clinic_id = t.clinic_id
        AND p.id::text = substring(t.description FROM '\(([0-9a-fA-F-]{36})\)')
    ),
    (
      SELECT min(p.id::text)::uuid
      FROM public.profiles p
      WHERE p.clinic_id = t.clinic_id
        AND t.description = 'Pagamento de comissão para ' || p.full_name
      HAVING count(*) = 1
    ),
    (
      SELECT min(p.id::text)::uuid
      FROM public.profiles p
      WHERE p.clinic_id = t.clinic_id
        AND (
          strpos(t.description, p.id::text) > 0
          OR strpos(t.description, p.full_name) > 0
        )
      HAVING count(*) = 1
    )
  ) AS professional_id
) matched
WHERE t.type = 'expense'
  AND t.category = 'Comissão fisioterapeuta'
  AND t.status = 'paid'
  AND t.amount > 0
  AND matched.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.commission_payments cp WHERE cp.transaction_id = t.id
  );
