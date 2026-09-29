import { Dispatch, SetStateAction } from "react";
import { clsx } from "clsx";
import { CheckCircle2, CreditCard, Clock, Wallet } from "lucide-react";
import { CREDIT_CARD_METHOD, PAYMENT_METHODS } from "../../lib/payments";
import { buildPaymentPlan, defaultFirstDueDate } from "./pagamento";
import type { NewPatientForm, PaymentMode } from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

const inputClass =
  "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

const MODES: Array<{ value: PaymentMode; title: string; hint: string; icon: typeof Wallet }> = [
  {
    value: "paid_full",
    title: "Pagou tudo agora",
    hint: "Pix, dinheiro, débito ou cartão de crédito (à vista ou parcelado na maquininha).",
    icon: CheckCircle2,
  },
  {
    value: "installments",
    title: "Vai pagar em parcelas para a clínica",
    hint: "Pix mês a mês, boleto, dinheiro depois... Pode ter entrada hoje.",
    icon: Wallet,
  },
  {
    value: "unpaid",
    title: "Ainda não pagou nada",
    hint: "O valor total fica em aberto em Recebimentos.",
    icon: Clock,
  },
];

const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

type Props = {
  formData: NewPatientForm;
  setFormData: Dispatch<SetStateAction<NewPatientForm>>;
  total: number;
  disabled?: boolean;
};

export const PagamentoContratacao = ({ formData, setFormData, total, disabled }: Props) => {
  const plan = buildPaymentPlan(formData, total);
  const isCredit = formData.payment_method === CREDIT_CARD_METHOD;

  const update = (changes: Partial<NewPatientForm>) =>
    setFormData((current) => ({ ...current, ...changes }));

  const chooseMode = (mode: PaymentMode) =>
    setFormData((current) => ({
      ...current,
      payment_mode: mode,
      amount_paid: mode === "installments" ? current.amount_paid : 0,
      payment_method: mode === "unpaid" ? "" : current.payment_method,
      installments: mode === "installments" ? Math.max(current.installments, 2) : 1,
      first_due_date: defaultFirstDueDate(current, mode),
    }));

  const chooseMethod = (method: string) =>
    setFormData((current) => ({
      ...current,
      payment_method: method,
      card_installments: method === CREDIT_CARD_METHOD ? current.card_installments : 1,
      card_settlement: method === CREDIT_CARD_METHOD ? current.card_settlement : "now",
    }));

  const chooseCardInstallments = (count: number) =>
    setFormData((current) => {
      // À vista não tem parcela a cair: volta para "caiu tudo".
      if (count <= 1) {
        return { ...current, card_installments: 1, card_settlement: "now", first_due_date: "" };
      }
      return {
        ...current,
        card_installments: count,
        first_due_date:
          current.card_settlement === "monthly"
            ? current.first_due_date || defaultFirstDueDate(current, "paid_full", true)
            : current.first_due_date,
      };
    });

  const chooseSettlement = (settlement: NewPatientForm["card_settlement"]) =>
    setFormData((current) => ({
      ...current,
      card_settlement: settlement,
      first_due_date:
        settlement === "monthly"
          ? current.first_due_date || defaultFirstDueDate(current, "paid_full", true)
          : "",
    }));

  if (total <= 0) {
    return (
      <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        Informe o valor das sessões ou dos procedimentos para registrar o pagamento.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className={labelClass}>Como o paciente pagou?</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3" role="radiogroup">
          {MODES.map((mode) => {
            const selected = formData.payment_mode === mode.value;
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => chooseMode(mode.value)}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                  selected
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-900/20"
                    : "border-slate-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-950",
                )}
              >
                <Icon size={20} className={clsx("mt-0.5 shrink-0", selected ? "text-brand-600" : "text-slate-400")} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{mode.title}</span>
                  <span className="block text-xs text-slate-500">{mode.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {formData.payment_mode === "paid_full" && (
        <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>Forma de pagamento</label>
              <select
                className={inputClass}
                disabled={disabled}
                value={formData.payment_method}
                onChange={(event) => chooseMethod(event.target.value)}
              >
                <option value="">Escolha...</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
            {isCredit && (
              <div className="space-y-2">
                <label className={labelClass}>Parcelou em quantas vezes na maquininha?</label>
                <select
                  className={inputClass}
                  disabled={disabled}
                  value={formData.card_installments}
                  onChange={(event) => chooseCardInstallments(Number(event.target.value))}
                >
                  {INSTALLMENT_OPTIONS.map((count) => (
                    <option key={count} value={count}>{count === 1 ? "À vista (1x)" : `${count}x`}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isCredit && formData.card_installments > 1 && (
            <div className="space-y-2">
              <p className={labelClass}>Como o dinheiro cai na conta da clínica?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
                {([
                  ["now", "Caiu tudo de uma vez", "A maquininha antecipou. Registra o valor total como recebido hoje."],
                  ["monthly", "Cai mês a mês", "Cria as parcelas da maquininha em Recebimentos para você confirmar quando cada uma cair."],
                ] as const).map(([value, title, hint]) => {
                  const selected = formData.card_settlement === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => chooseSettlement(value)}
                      className={clsx(
                        "rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-900/20"
                          : "border-slate-200 hover:border-brand-300 dark:border-slate-800",
                      )}
                    >
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
                      <span className="block text-xs text-slate-500">{hint}</span>
                    </button>
                  );
                })}
              </div>
              {formData.card_settlement === "monthly" && (
                <div className="space-y-2 sm:max-w-xs">
                  <label className={labelClass}>Quando cai a 1ª parcela?</label>
                  <input
                    type="date"
                    className={inputClass}
                    disabled={disabled}
                    value={formData.first_due_date}
                    onChange={(event) => update({ first_due_date: event.target.value })}
                  />
                  <p className="text-xs text-slate-500">Normalmente 30 dias depois da venda.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {formData.payment_mode === "installments" && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-2">
            <label className={labelClass}>Entrada paga hoje (opcional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              disabled={disabled}
              value={formData.amount_paid || ""}
              placeholder="0,00"
              onWheel={(event) => event.currentTarget.blur()}
              onChange={(event) => update({ amount_paid: Math.max(Number(event.target.value) || 0, 0) })}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Forma de pagamento da entrada</label>
            <select
              className={inputClass}
              disabled={disabled || !(Number(formData.amount_paid) > 0)}
              value={Number(formData.amount_paid) > 0 ? formData.payment_method : ""}
              onChange={(event) => update({ payment_method: event.target.value })}
            >
              <option value="">{Number(formData.amount_paid) > 0 ? "Escolha..." : "Sem entrada"}</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Quantas parcelas o paciente vai pagar?</label>
            <select
              className={inputClass}
              disabled={disabled}
              value={formData.installments}
              onChange={(event) => update({ installments: Number(event.target.value) })}
            >
              {INSTALLMENT_OPTIONS.map((count) => (
                <option key={count} value={count}>{count === 1 ? "1 parcela" : `${count} parcelas`}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Vencimento da 1ª parcela</label>
            <input
              type="date"
              className={inputClass}
              disabled={disabled}
              value={formData.first_due_date}
              onChange={(event) => update({ first_due_date: event.target.value })}
            />
          </div>
        </div>
      )}

      {formData.payment_mode === "unpaid" && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-2">
            <label className={labelClass}>Até quando deve pagar?</label>
            <input
              type="date"
              className={inputClass}
              disabled={disabled}
              value={formData.first_due_date}
              onChange={(event) => update({ first_due_date: event.target.value })}
            />
          </div>
        </div>
      )}

      {formData.payment_mode && <PaymentSummary plan={plan} total={total} />}
    </div>
  );
};

const PaymentSummary = ({ plan, total }: { plan: ReturnType<typeof buildPaymentPlan>; total: number }) => {
  const settled = plan.pending.length === 0 || plan.fromCardMachine;
  const pendingList = plan.pending.map((item) => formatDate(item.dueDate)).join(" · ");
  const sameAmount = plan.pending.every((item) => item.amount === plan.pending[0]?.amount);
  const pendingAmounts = sameAmount && plan.pending.length
    ? `${plan.pending.length} × ${currency.format(plan.pending[0].amount)}`
    : plan.pending.map((item) => currency.format(item.amount)).join(" + ");

  return (
    <div
      aria-live="polite"
      className={clsx(
        "space-y-1 rounded-xl border p-4 text-sm",
        settled
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">Resumo do pagamento</p>
      {plan.fromCardMachine ? (
        <>
          <p className="font-semibold">✓ Paciente quitado · {plan.methodLabel}</p>
          <p className="flex items-start gap-1.5">
            <CreditCard size={16} className="mt-0.5 shrink-0" />
            <span>
              A maquininha vai depositar {pendingAmounts}: {pendingList}. Confirme em Financeiro → Recebimentos quando cada uma cair na conta.
            </span>
          </p>
        </>
      ) : (
        <>
          {plan.receivedToday > 0 && (
            <p className="font-semibold">
              ✓ {currency.format(plan.receivedToday)} recebido{plan.receivedToday === total ? "s" : ""} hoje
              {plan.methodLabel ? ` · ${plan.methodLabel}` : ""}
            </p>
          )}
          {plan.pending.length === 0 ? (
            <p>Nada fica para receber deste paciente.</p>
          ) : (
            <p>
              ⚠ Fica{plan.pending.length > 1 ? "m" : ""} para receber do paciente: {pendingAmounts} ({pendingList}). Dê baixa em
              Financeiro → Recebimentos quando o paciente pagar.
            </p>
          )}
        </>
      )}
    </div>
  );
};
