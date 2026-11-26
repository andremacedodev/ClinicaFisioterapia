import { useEffect, useState } from "react";
import {
  currentCommissionRule,
  formatCommission,
  suggestedCommission,
  type CommissionRule,
} from "../../lib/commissionRules";
import type { Fisioterapeuta, NovoAgendamentoForm, Paciente } from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatMoney = (value: number) => currency.format(value || 0);
const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sameMoney(a: number | undefined, b: number | undefined): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) < 0.005;
}

function parseNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** De onde vem o valor bruto: pacote, procedimento combinado ou digitado. */
function classValueSource(
  form: NovoAgendamentoForm,
  patient: Paciente | undefined,
): string {
  const pacote = patient?.pacoteAtivo;
  if (form.pacoteId && pacote && pacote.id === form.pacoteId) {
    return sameMoney(form.valorAula, pacote.valorAula)
      ? `Valor por aula do pacote de ${pacote.totalAulas} aulas.`
      : `Alterado só nesta aula. No pacote: ${formatMoney(pacote.valorAula)} por aula.`;
  }
  if (form.pacoteId) return "Valor por aula do pacote desta aula.";

  const procedure =
    patient?.procedimentos?.find((item) => item.name === form.tipoSessao) ??
    patient?.procedimentos?.[0];
  if (procedure) {
    const agreed = Number(procedure.agreed_value) || 0;
    return sameMoney(form.valorAula, agreed)
      ? `Valor combinado no cadastro para ${procedure.name}.`
      : `Alterado só nesta aula. Combinado no cadastro: ${formatMoney(agreed)}.`;
  }
  return "Aula avulsa: digite o valor cobrado.";
}

type Props = {
  form: NovoAgendamentoForm;
  patient: Paciente | undefined;
  professional: Fisioterapeuta | undefined;
  isCommissioned: boolean;
  commissionRules: CommissionRule[];
  onChange: (changes: Partial<NovoAgendamentoForm>) => void;
};

/**
 * Valores da aula na Agenda: valor bruto (com a origem), comissão em % ou R$
 * e o resumo de quanto fica com a fisioterapeuta e com a clínica.
 * Só o valor em R$ é gravado (appointments.commission_amount).
 */
export function ClassValuesSection({
  form,
  patient,
  professional,
  isCommissioned,
  commissionRules,
  onChange,
}: Props) {
  const when = form.data ? new Date(`${form.data}T${form.horaInicio || "00:00"}:00`) : new Date();
  const rule = currentCommissionRule(commissionRules, form.fisioterapeutaId || null, when);
  const ruleIsFixed = rule?.commission_type === "fixed";
  const classValue = form.valorAula ?? 0;
  const commission = form.valorComissao ?? 0;
  const ruleAmount = round2(
    suggestedCommission(commissionRules, form.fisioterapeutaId || null, classValue, when),
  );
  const percentOfClass = classValue > 0 ? (commission / classValue) * 100 : 0;
  const clinicShare = round2(classValue - commission);

  const [mode, setMode] = useState<"percent" | "value">(ruleIsFixed ? "value" : "percent");
  // Texto digitado no campo de % (para não reformatar enquanto a pessoa digita).
  const [percentDraft, setPercentDraft] = useState<string | null>(null);

  useEffect(() => {
    setMode(ruleIsFixed ? "value" : "percent");
    setPercentDraft(null);
    // Ao trocar de aula ou de fisioterapeuta, volta ao modo da regra dela.
  }, [ruleIsFixed, form.fisioterapeutaId]);

  const shownPercent =
    percentDraft ?? (classValue > 0 ? String(round2(percentOfClass)) : "");

  const changeClassValue = (raw: string) => {
    const value = parseNumber(raw);
    // Em %, mantém a porcentagem e recalcula a comissão.
    if (isCommissioned && mode === "percent" && classValue > 0) {
      const percent = parseNumber(shownPercent) ?? 0;
      onChange({
        valorAula: value,
        valorComissao: value ? round2((value * percent) / 100) : undefined,
      });
      return;
    }
    onChange({ valorAula: value });
  };

  const changePercent = (raw: string) => {
    setPercentDraft(raw);
    const percent = parseNumber(raw);
    onChange({
      valorComissao:
        percent === undefined ? undefined : round2((classValue * Math.min(percent, 100)) / 100),
    });
  };

  const changeCommissionValue = (raw: string) => {
    const value = parseNumber(raw);
    onChange({ valorComissao: value === undefined ? undefined : round2(value) });
  };

  const applyRule = () => {
    setPercentDraft(null);
    onChange({ valorComissao: ruleAmount || undefined });
  };

  // Primeiro nome: os rótulos ficam curtos mesmo com nome completo comprido.
  const professionalName = professional?.nome?.trim().split(/\s+/)[0] || "a fisioterapeuta";
  const differsFromRule = isCommissioned && !sameMoney(commission, ruleAmount);
  const overClassValue = isCommissioned && classValue > 0 && commission > classValue;

  return (
    <fieldset className="class-values">
      <legend className="class-values-title">Valores desta aula</legend>

      <div className="form-group">
        <label className="form-label" htmlFor="class-value">
          Valor bruto da aula
        </label>
        <div className="money-field">
          <span className="money-affix" aria-hidden="true">R$</span>
          <input
            id="class-value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="form-input"
            value={form.valorAula ?? ""}
            onChange={(event) => changeClassValue(event.target.value)}
          />
        </div>
        <span className="form-help">{classValueSource(form, patient)}</span>
      </div>

      {isCommissioned && (
        <div className="form-group">
          <div className="class-values-label-row">
            <label
              className="form-label"
              htmlFor={mode === "percent" ? "commission-percent" : "commission-value"}
              title={professional?.nome}
            >
              Comissão de {professionalName}
            </label>
            <div className="segmented" role="group" aria-label="Definir a comissão por">
              <button
                type="button"
                className={mode === "percent" ? "active" : ""}
                aria-pressed={mode === "percent"}
                onClick={() => {
                  setMode("percent");
                  setPercentDraft(null);
                }}
              >
                %
              </button>
              <button
                type="button"
                className={mode === "value" ? "active" : ""}
                aria-pressed={mode === "value"}
                onClick={() => setMode("value")}
              >
                R$
              </button>
            </div>
          </div>

          {mode === "percent" ? (
            <div className="money-field suffix">
              <input
                id="commission-percent"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                className="form-input"
                value={shownPercent}
                disabled={classValue <= 0}
                onChange={(event) => changePercent(event.target.value)}
                onBlur={() => setPercentDraft(null)}
              />
              <span className="money-affix" aria-hidden="true">%</span>
            </div>
          ) : (
            <div className="money-field">
              <span className="money-affix" aria-hidden="true">R$</span>
              <input
                id="commission-value"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="form-input"
                value={form.valorComissao ?? ""}
                onChange={(event) => changeCommissionValue(event.target.value)}
              />
            </div>
          )}

          {mode === "percent" && classValue <= 0 && (
            <span className="form-help">Informe o valor bruto para calcular a porcentagem.</span>
          )}

          <span className="form-help">
            Regra atual de {professionalName}: <strong>{formatCommission(rule)}</strong>
            {classValue > 0 || ruleIsFixed ? ` = ${formatMoney(ruleAmount)} nesta aula.` : "."}
            {differsFromRule && (
              <>
                {" "}
                <button type="button" className="link-button" onClick={applyRule}>
                  Usar a regra
                </button>
              </>
            )}
          </span>
        </div>
      )}

      {isCommissioned && classValue > 0 && (
        <div className={`class-values-summary${overClassValue ? " warning" : ""}`} role="status">
          <div>
            <span className="summary-label">{professionalName} recebe</span>
            <strong>{formatMoney(commission)}</strong>
            <span className="summary-detail">{formatPercent(round2(percentOfClass))} da aula</span>
          </div>
          <div>
            <span className="summary-label">Clínica fica com</span>
            <strong>{formatMoney(clinicShare)}</strong>
            <span className="summary-detail">{formatPercent(round2(100 - percentOfClass))} da aula</span>
          </div>
          {overClassValue && (
            <p className="summary-warning">A comissão está maior que o valor da aula.</p>
          )}
        </div>
      )}

      {!isCommissioned && professional && (
        <span className="form-help">
          {professional.nome} não recebe comissão por aula.
        </span>
      )}
    </fieldset>
  );
}
