-- Conferência ANTES da migration 20261001000000_commission_payments.sql.
-- Só lê dados: não altera nada.
--
-- pago_em / valor ......... o pagamento como está hoje
-- sera_atribuido_a ........ profissional que a migration vai associar
--                           (não identificado: você escolhe na revisão)
-- hoje_conta_para ......... para quem o cálculo atual está contando esse
--                           pagamento (mais de um nome = contado em dobro)
-- mes_seguinte_ao_trabalho  dica: pagamentos feitos até o dia 10 costumam
--                           ser do mês anterior
select
  t.due_date as pago_em,
  t.amount as valor,
  coalesce(
    por_id.full_name,
    por_nome.full_name,
    case when hoje.quantidade = 1 then hoje.nomes end,
    'NÃO IDENTIFICADO (você escolhe na revisão)'
  ) as sera_atribuido_a,
  hoje.nomes as hoje_conta_para,
  extract(day from t.due_date) <= 10 as mes_seguinte_ao_trabalho,
  t.description as descricao
from public.transactions t
left join public.profiles por_id
  on por_id.clinic_id = t.clinic_id
 and por_id.id::text = substring(t.description from '\(([0-9a-fA-F-]{36})\)')
left join lateral (
  select min(p.full_name) as full_name
  from public.profiles p
  where p.clinic_id = t.clinic_id
    and t.description = 'Pagamento de comissão para ' || p.full_name
  having count(*) = 1
) por_nome on por_id.id is null
cross join lateral (
  select string_agg(p.full_name, ', ' order by p.full_name) as nomes, count(*) as quantidade
  from public.profiles p
  where p.clinic_id = t.clinic_id
    and (strpos(t.description, p.id::text) > 0 or strpos(t.description, p.full_name) > 0)
) hoje
where t.type = 'expense'
  and t.category = 'Comissão fisioterapeuta'
  and t.status = 'paid'
order by t.due_date;
