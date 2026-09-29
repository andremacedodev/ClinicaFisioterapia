import { Card } from "../../components/ui/Card";
import { useState } from "react";
import { ArrowUpDown, CreditCard, Filter, Receipt, Trash2 } from "lucide-react";
import { ReceivableFilter, ReceivableItem, badgeVariantForPayment, currencyFormatter, formatDate, money, paymentLabel, useFinancial } from "./financialCore";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export const FinancialReceivables = () => {
  const {
    receivableFilter,
    setReceivableFilter,
    dueSort,
    setDueSort,
    saving,
    isPhysio,
    isAdmin,
    receivables,
    openPaymentModal,
    openProcedurePaymentModal,
    handleDeleteTransaction,
    handleDeletePackageInstallment,
    printReceipt,
    printTransactionReceipt,
    legacyCardPackages,
    openLegacyCardSettlement,
  } = useFinancial();
  const [dismissedLegacy, setDismissedLegacy] = useState<string[]>(readDismissedLegacy);
  const pendingLegacy = legacyCardPackages.filter(
    (item) => !dismissedLegacy.includes(item.packageItem.id),
  );
  const dismissLegacy = (packageId: string) => {
    const next = [...dismissedLegacy, packageId];
    setDismissedLegacy(next);
    try {
      localStorage.setItem(DISMISSED_LEGACY_KEY, JSON.stringify(next));
    } catch {
      // sem armazenamento local: o aviso volta na próxima visita
    }
  };

  return (
    <>
      {!isPhysio && pendingLegacy.length > 0 && (
        <Card className="p-0 overflow-hidden border-sky-200">
          <div className="border-b border-sky-100 bg-sky-50/70 p-4 sm:p-6 dark:border-sky-900/40 dark:bg-sky-900/10">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <CreditCard size={18} className="text-sky-600" />
              Pacotes pagos no cartão com parcelas em aberto ({pendingLegacy.length})
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Estes pacotes foram registrados com cartão de crédito, mas as parcelas ficaram
              como se o paciente ainda devesse. Se o paciente pagou tudo no cartão, dê baixa em
              tudo de uma vez. Se ele realmente ainda deve, escolha "O paciente ainda deve".
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingLegacy.map((item) => (
              <div
                key={item.packageItem.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.packageItem.patients?.full_name ?? "Paciente"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Registrado como "{item.packageItem.payment_method}" em{" "}
                    {formatDate((item.packageItem.start_date || item.packageItem.created_at).slice(0, 10))} ·{" "}
                    {item.openCount} {item.openCount === 1 ? "parcela" : "parcelas"} em aberto ·{" "}
                    {currencyFormatter.format(item.openAmount)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openLegacyCardSettlement(item)}>
                    Pago no cartão: dar baixa em tudo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dismissLegacy(item.packageItem.id)}>
                    O paciente ainda deve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isPhysio && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Recebíveis
              </h3>
              <p className="text-sm text-slate-500">
                Veja parcelas e procedimentos em aberto, pagos ou tudo
                junto.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <Filter size={16} />
                <select
                  className="min-h-11 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none"
                  value={receivableFilter}
                  onChange={(event) =>
                    setReceivableFilter(
                      event.target.value as ReceivableFilter,
                    )
                  }
                >
                  <option value="open">Em aberto</option>
                  <option value="card">Só cartão (maquininha)</option>
                  <option value="paid">Pagas</option>
                  <option value="all">Todas</option>
                </select>
              </label>
              <Button
                variant="outline"
                onClick={() =>
                  setDueSort((current) =>
                    current === "asc" ? "desc" : "asc",
                  )
                }
              >
                <ArrowUpDown size={16} />
                Vencimento {dueSort === "asc" ? "mais antigo" : "mais novo"}
              </Button>
            </div>
          </div>

          <div className="mobile-card-table overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Parcela</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Recebido</th>
                  <th className="px-6 py-4">Saldo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {receivables.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum recebível encontrado para este filtro.
                    </td>
                  </tr>
                ) : (
                  receivables.map((row: ReceivableItem) => (
                    <tr
                      key={
                        row.kind === "package"
                          ? row.installment.id
                          : row.transaction.id
                      }
                    >
                      <td className="px-6 py-4" data-label="Paciente">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {row.patientName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fisio: {row.professionalName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.kind === "package"
                            ? `Pacote de ${row.packageItem.total_lessons} aulas · total ${currencyFormatter.format(money(row.packageItem.total_amount))} · saldo do pacote ${currencyFormatter.format(Math.max(money(row.packageItem.total_amount) - money(row.packageItem.amount_paid), 0))}`
                            : row.kind === "package_receipt"
                              ? "Entrada de pacote"
                              : "Procedimentos avulsos"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold" data-label="Parcela">
                        {row.kind === "package"
                          ? `#${row.installment.installment_number}`
                          : row.kind === "package_receipt"
                            ? "Entrada"
                            : "Procedimento"}
                        {row.cardMachine && (
                          <span
                            className="mt-1 flex w-fit items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                            title="O paciente já pagou no cartão; esta parcela é o depósito da maquininha."
                          >
                            <CreditCard size={12} /> Cartão
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500" data-label="Vencimento">
                        {formatDate(
                          row.kind === "package"
                            ? row.installment.due_date
                            : row.transaction.due_date,
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm" data-label="Valor">
                        {currencyFormatter.format(
                          row.kind === "package"
                            ? money(row.installment.amount)
                            : money(row.transaction.amount),
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-600 font-semibold" data-label="Recebido">
                        {currencyFormatter.format(
                          row.kind === "package"
                            ? money(row.installment.amount_paid)
                            : row.transaction.status === "paid"
                              ? money(row.transaction.amount)
                              : 0,
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold" data-label="Saldo">
                        {currencyFormatter.format(row.remaining)}
                      </td>
                      <td className="px-6 py-4" data-label="Status">
                        {row.cardMachine && row.status !== "pago" ? (
                          <Badge variant="info">Aguardando depósito</Badge>
                        ) : (
                          <Badge variant={badgeVariantForPayment(row.status)}>
                            {paymentLabel[row.status]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4" data-label="Ações">
                        <div className="flex gap-2">
                          {row.remaining > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                row.kind === "package"
                                  ? openPaymentModal(
                                      row.packageItem,
                                      row.installment,
                                    )
                                  : openProcedurePaymentModal(
                                      row.transaction,
                                    )
                              }
                            >
                              {row.cardMachine ? "Confirmar que caiu" : "Registrar"}
                            </Button>
                          )}
                          {row.kind === "package" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  printReceipt(
                                    row.packageItem,
                                    row.installment,
                                  )
                                }
                              >
                                <Receipt size={14} />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    handleDeletePackageInstallment(
                                      row.packageItem,
                                      row.installment,
                                    )
                                  }
                                  disabled={saving}
                                  title="Excluir parcela"
                                >
                                  <Trash2 size={14} />
                                  Excluir
                                </Button>
                              )}
                            </>
                          )}
                          {isAdmin && row.kind === "procedure" && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteTransaction(row.transaction)}
                              disabled={saving}
                              title="Excluir recebível"
                            >
                              <Trash2 size={14} />
                              Excluir
                            </Button>
                          )}
                          {row.kind === "package_receipt" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  printTransactionReceipt(row.transaction)
                                }
                                title="Imprimir recibo"
                              >
                                <Receipt size={14} />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    handleDeleteTransaction(row.transaction)
                                  }
                                  disabled={saving}
                                  title="Excluir entrada"
                                >
                                  <Trash2 size={14} /> Excluir
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
};

const DISMISSED_LEGACY_KEY = "financeiro:pacotes-cartao-ignorados";

function readDismissedLegacy(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_LEGACY_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
