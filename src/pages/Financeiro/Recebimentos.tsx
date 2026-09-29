import { Card } from "../../components/ui/Card";
import { ArrowUpDown, Filter, Receipt, Trash2 } from "lucide-react";
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
  } = useFinancial();

  return (
    <>
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
                        <Badge variant={badgeVariantForPayment(row.status)}>
                          {paymentLabel[row.status]}
                        </Badge>
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
                              Registrar
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
