import { supabase } from "./supabase";
import {
  commissionFromRule,
  DEFAULT_COMMISSION_RULE,
  findCommissionRule,
} from "./commission";

export type CommissionType = "percent" | "fixed";

export type CommissionRule = {
  id?: string;
  professional_id: string;
  commission_type: CommissionType;
  commission_value: number | string;
  valid_from: string;
  created_at?: string;
  created_by?: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "40%" ou "R$ 25,00 por aula". */
export function formatCommission(
  rule: { commission_type: string; commission_value: number | string } | null | undefined,
): string {
  const applied = rule ?? DEFAULT_COMMISSION_RULE;
  const value = Number(applied.commission_value) || 0;
  return applied.commission_type === "fixed"
    ? `${currency.format(value)} por aula`
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Regra que vale para o profissional em `when` (padrão: agora). */
export function currentCommissionRule(
  rules: CommissionRule[],
  professionalId: string | null | undefined,
  when: string | Date = new Date(),
): CommissionRule | null {
  return findCommissionRule(rules, professionalId, when) as CommissionRule | null;
}

export function suggestedCommission(
  rules: CommissionRule[],
  professionalId: string | null | undefined,
  classValue: number | undefined,
  when: string | Date = new Date(),
): number {
  const rule = currentCommissionRule(rules, professionalId, when);
  return commissionFromRule(rule, classValue ?? 0);
}

/**
 * Regras de comissão visíveis ao usuário (admin: todas da clínica;
 * fisioterapeuta: só as dela). Sem a migration aplicada, devolve
 * `supported: false` e o cálculo usa 40%.
 */
export async function loadCommissionRules(
  clinicId: string,
): Promise<{ supported: boolean; rules: CommissionRule[]; error?: string }> {
  const { data, error } = await supabase
    .from("professional_commission_rules")
    .select("id, professional_id, commission_type, commission_value, valid_from, created_at, created_by")
    .eq("clinic_id", clinicId)
    .order("valid_from", { ascending: true });

  if (error) {
    const missingTable =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /professional_commission_rules/.test(error.message);
    if (missingTable) {
      console.warn(
        "Tabela professional_commission_rules ausente: aplique a migration de comissão configurável. Usando 40%.",
      );
      return { supported: false, rules: [] };
    }
    return { supported: true, rules: [], error: error.message };
  }

  return { supported: true, rules: (data ?? []) as CommissionRule[] };
}
