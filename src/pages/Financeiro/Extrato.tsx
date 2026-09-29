import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { badgeVariantForTransaction, currencyFormatter, formatDate, money, transactionStatusLabel, useFinancial } from "./financialCore";
import { Badge } from "../../components/ui/Badge";
import { StorageFileLink } from "../../components/ui/StorageFileLink";
import { clsx } from "clsx";
import { Receipt, Trash2 } from "lucide-react";

export const FinancialStatement = () => {
  const {
    saving,
    historyStartDate,
    setHistoryStartDate,
    historyEndDate,
    setHistoryEndDate,
    isPhysio,
    isAdmin,
    resetHistoryPeriod,
    filteredHistoryTransactions,
    handleDeleteTransaction,
    printTransactionReceipt,
  } = useFinancial();

  return (
    <>
      {!isPhysio && (
        <div>
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Histórico financeiro
                </h3>
                <p className="text-sm text-slate-500">
                  Entradas, pendências e comissões pagas ficam registradas aqui.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  De
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(event) =>
                      setHistoryStartDate(event.target.value)
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Até
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(event) =>
                      setHistoryEndDate(event.target.value)
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="self-end"
                  onClick={resetHistoryPeriod}
                >
                  Últimos 30 dias
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Valor</th>
                  {isAdmin && <th className="px-6 py-4">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistoryTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum lançamento encontrado neste período.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(transaction.due_date)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            transaction.type === "income"
                              ? "success"
                              : "warning"
                          }
                        >
                          {transaction.type === "income"
                            ? "Entrada"
                            : "Saída"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {transaction.category}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={badgeVariantForTransaction(
                            transaction.status,
                          )}
                        >
                          {transactionStatusLabel[transaction.status]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {transaction.description ??
                          transaction.patients?.full_name ??
                          "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500" data-label="Documento">
                        {transaction.attachments?.[0] ? (
                          <StorageFileLink
                            bucket="transaction-docs"
                            value={transaction.attachments[0]}
                            className="text-brand-600 hover:underline"
                          >
                            Ver documento
                          </StorageFileLink>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td
                        className={clsx(
                          "px-6 py-4 text-sm font-bold",
                          transaction.type === "income"
                            ? "text-emerald-600"
                            : "text-rose-600",
                        )}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {currencyFormatter.format(
                          money(transaction.amount),
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4" data-label="Ações">
                          <div className="flex gap-2">
                            {transaction.type === "income" &&
                              transaction.status === "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    printTransactionReceipt(transaction)
                                  }
                                  title="Imprimir recibo"
                                >
                                  <Receipt size={14} />
                                </Button>
                              )}
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteTransaction(transaction)}
                              disabled={saving}
                            >
                              <Trash2 size={14} />
                              Excluir
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </div>
      )}
    </>
  );
};
