import { createPortal } from "react-dom";
import { Card } from "../../components/ui/Card";
import { FileDown, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { currencyFormatter, formatBRLValue, formatDate, parseCurrencyValue, useFinancial } from "./financialCore";

export const FinancialModals = () => {
  const {
    paymentTarget,
    setPaymentTarget,
    commissionTarget,
    setCommissionTarget,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    paymentReceivedDate,
    setPaymentReceivedDate,
    paymentNotes,
    setPaymentNotes,
    saving,
    financialReportOpen,
    setFinancialReportOpen,
    financialReportStartDate,
    setFinancialReportStartDate,
    financialReportEndDate,
    setFinancialReportEndDate,
    financialReportSections,
    setFinancialReportSections,
    handleRegisterPayment,
    handleRegisterCommissionPayment,
    generateFinancialPdf,
    supportsCommissionPayments,
    commissionPaymentAmount,
    setCommissionPaymentAmount,
    commissionPaidAt,
    setCommissionPaidAt,
    selectedCommissionPeriod,
    error,
  } = useFinancial();

  return (
    <>
  {financialReportOpen &&
    createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-lg">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Exportar relatório financeiro
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Escolha o período e as informações que devem aparecer no PDF.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              onClick={() => setFinancialReportOpen(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Data inicial
                <input type="date" value={financialReportStartDate} onChange={(event) => setFinancialReportStartDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Data final
                <input type="date" value={financialReportEndDate} onChange={(event) => setFinancialReportEndDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900" />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Seções do relatório</legend>
              <div className="mt-3 space-y-2">
                {([
                  ["payable", "Contas a pagar", "Despesas pendentes ou vencidas no período."],
                  ["paid", "Contas pagas", "Despesas já quitadas no período."],
                  ["receipts", "Recebimentos", "Entradas financeiras recebidas no período."],
                ] as const).map(([key, label, description]) => (
                  <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                    <input type="checkbox" checked={financialReportSections[key]} onChange={(event) => setFinancialReportSections((current) => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-4 w-4 accent-brand-600" />
                    <span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span><span className="text-xs text-slate-500">{description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900">O relatório abrirá em outra aba. Na janela de impressão, escolha “Salvar como PDF”.</p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFinancialReportOpen(false)}>Cancelar</Button>
              <Button type="button" className="flex-1 gap-2" onClick={generateFinancialPdf}><FileDown size={16} />Gerar PDF</Button>
            </div>
          </div>
        </Card>
      </div>,
      document.body,
    )}

  {paymentTarget &&
    createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Registrar pagamento
              </h2>
              <p className="text-sm text-slate-500">
                {paymentTarget.kind === "package"
                  ? `${paymentTarget.packageItem.patients?.full_name ?? "Paciente"} · Parcela #${paymentTarget.installment.installment_number}`
                  : `${paymentTarget.transaction.patients?.full_name ?? "Paciente"} · Procedimentos`}
              </p>
            </div>
            <button
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
              onClick={() => setPaymentTarget(null)}
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleRegisterPayment} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Valor recebido
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="Ex.: 1000"
                autoComplete="off"
                className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(parseCurrencyValue(event.target.value))
                }
              />
              <p className="mt-2 text-sm text-slate-500">
                Valor mostrado: {formatBRLValue(paymentAmount) || "R$ 0,00"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Forma de pagamento
              </label>
              <select
                className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option>Pix</option>
                <option>Cartão de crédito</option>
                <option>Cartão de débito</option>
                <option>Dinheiro</option>
                <option>Transferência</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Data do recebimento
              </label>
              <input
                type="date"
                required
                className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                value={paymentReceivedDate}
                onChange={(event) => setPaymentReceivedDate(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Observação <span className="text-slate-400">(opcional)</span>
              </label>
              <textarea
                rows={3}
                className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentTarget(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" isLoading={saving}>
                Salvar
              </Button>
            </div>
          </form>
        </Card>
      </div>,
      document.body,
    )}

  {commissionTarget &&
    createPortal(
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Registrar comissão
              </h2>
              <p className="text-sm text-slate-500">
                {commissionTarget.professionalName}
              </p>
            </div>
            <button
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
              onClick={() => setCommissionTarget(null)}
            >
              <X size={18} />
            </button>
          </div>

          {supportsCommissionPayments ? (
            <div className="space-y-4 mb-4">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4">
                <p className="text-sm text-slate-500">Referente a</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {formatDate(selectedCommissionPeriod.startDate)} a{" "}
                  {formatDate(selectedCommissionPeriod.endDate)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Saldo a pagar no período:{" "}
                  {currencyFormatter.format(commissionTarget.professionalShare)}.
                  Para outro período, feche e mude as datas do relatório.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Data do pagamento
                </label>
                <input
                  type="date"
                  required
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  value={commissionPaidAt}
                  onChange={(event) => setCommissionPaidAt(event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valor pago
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  value={commissionPaymentAmount}
                  onChange={(event) =>
                    setCommissionPaymentAmount(parseCurrencyValue(event.target.value))
                  }
                />
                <p className="mt-2 text-sm text-slate-500">
                  Valor mostrado: {formatBRLValue(commissionPaymentAmount) || "R$ 0,00"}.
                  Pode ser menor que o saldo (adiantamento).
                </p>
              </div>
              {error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 mb-4">
              <p className="text-sm text-slate-500">Valor da comissão</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {currencyFormatter.format(commissionTarget.professionalShare)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCommissionTarget(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              isLoading={saving}
              onClick={handleRegisterCommissionPayment}
            >
              Confirmar
            </Button>
          </div>
        </Card>
      </div>,
      document.body,
    )}
    </>
  );
};
