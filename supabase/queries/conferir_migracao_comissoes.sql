-- Conferência DEPOIS da migration 20261001000000_commission_payments.sql
-- (e antes de revisar os pagamentos antigos). Só lê dados.
--
-- Compara, por profissional e mês, o "Já pago" da regra antiga (despesas do
-- mês cujo texto contém o nome/ID) com o da regra nova (pagamentos com
-- período de referência). Lista só onde os valores são diferentes.
-- Resultado vazio = nenhum número mudou.
with antigo as (
  select p.id as professional_id, date_trunc('month', t.due_date)::date as mes, sum(t.amount) as valor
  from public.transactions t
  join public.profiles p
    on p.clinic_id = t.clinic_id
   and (strpos(t.description, p.id::text) > 0 or strpos(t.description, p.full_name) > 0)
  where t.type = 'expense'
    and t.category = 'Comissão fisioterapeuta'
    and t.status = 'paid'
  group by 1, 2
),
novo as (
  select professional_id, period_start as mes, sum(amount) as valor
  from public.commission_payments
  group by 1, 2
)
select
  p.full_name as profissional,
  to_char(coalesce(a.mes, n.mes), 'MM/YYYY') as mes,
  coalesce(a.valor, 0) as ja_pago_antes,
  coalesce(n.valor, 0) as ja_pago_agora
from antigo a
full join novo n on n.professional_id = a.professional_id and n.mes = a.mes
join public.profiles p on p.id = coalesce(a.professional_id, n.professional_id)
where coalesce(a.valor, 0) <> coalesce(n.valor, 0)
order by 2, 1;
