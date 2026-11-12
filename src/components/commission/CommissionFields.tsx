import type { CommissionType } from "../../lib/commissionRules";

export type CommissionDraft = {
  type: CommissionType;
  value: string;
};

const inputClassName =
  "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none";

/** Valida o rascunho. Retorna a mensagem de erro ou null. */
export function commissionDraftError(draft: CommissionDraft): string | null {
  if (draft.value.trim() === "") return "Informe o valor da comissão.";
  const value = parseCommissionValue(draft.value);
  if (!Number.isFinite(value) || value < 0) return "O valor da comissão não pode ser negativo.";
  if (draft.type === "percent" && value > 100) return "A porcentagem não pode passar de 100%.";
  return null;
}

// Aceita "40", "40,5", "40.5" e "1.234,56".
export function parseCommissionValue(raw: string): number {
  const text = raw.trim().replace(/\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return normalized === "" ? NaN : Number(normalized);
}

export function draftFromRule(
  rule: { commission_type: string; commission_value: number | string } | null | undefined,
): CommissionDraft {
  const type: CommissionType = rule?.commission_type === "fixed" ? "fixed" : "percent";
  const value = rule ? Number(rule.commission_value) : 40;
  return { type, value: value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) };
}

type Props = {
  value: CommissionDraft;
  onChange: (draft: CommissionDraft) => void;
  disabled?: boolean;
  idPrefix: string;
};

/** Escolha entre porcentagem do valor da aula e valor fixo por aula. */
export const CommissionFields = ({ value, onChange, disabled, idPrefix }: Props) => {
  const options: { type: CommissionType; label: string; help: string }[] = [
    { type: "percent", label: "Porcentagem", help: "% do valor de cada aula" },
    { type: "fixed", label: "Valor fixo", help: "R$ por aula dada ou falta paga" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de comissão">
        {options.map((option) => {
          const selected = value.type === option.type;
          return (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange({ ...value, type: option.type })}
              className={`rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                selected
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-xs opacity-80">{option.help}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        {value.type === "fixed" && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            R$
          </span>
        )}
        <input
          id={`${idPrefix}-commission-value`}
          inputMode="decimal"
          disabled={disabled}
          aria-label={value.type === "fixed" ? "Valor por aula em reais" : "Porcentagem"}
          className={`${inputClassName} ${value.type === "fixed" ? "pl-11" : "pr-10"}`}
          placeholder={value.type === "fixed" ? "25,00" : "40"}
          value={value.value}
          onChange={(event) => onChange({ ...value, value: event.target.value })}
        />
        {value.type === "percent" && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            %
          </span>
        )}
      </div>
    </div>
  );
};
