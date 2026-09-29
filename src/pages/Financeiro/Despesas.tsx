import { Card } from "../../components/ui/Card";
import { TransactionStatus, badgeVariantForTransaction, currencyFormatter, expenseCategories, expenseReminderDays, formatBRLValue, formatDate, getEffectiveTransactionStatus, getExpenseReminderLabel, getExpenseReminderTone, money, parseCurrencyValue, transactionStatusLabel, useFinancial } from "./financialCore";
import { Button } from "../../components/ui/Button";
import { AlertTriangle, Check, PlusCircle, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "../../components/ui/Badge";
import { StorageFileLink } from "../../components/ui/StorageFileLink";

export const FinancialExpenses = () => {
  const {
    expenseViewFilter,
    setExpenseViewFilter,
    saving,
    supportsTransactionAttachments,
    attachmentInputRef,
    expenseStartDate,
    setExpenseStartDate,
    expenseEndDate,
    setExpenseEndDate,
    expenseForm,
    setExpenseForm,
    expenseSectionRef,
    isPhysio,
    resetExpensePeriod,
    expenseReminders,
    filteredExpenseTransactions,
    expensePeriodTotals,
    handleRegisterExpense,
    handleOpenAttachmentUploader,
    handleAttachExpenseDocument,
    handleMarkExpensePaid,
    handleDeleteExpense,
  } = useFinancial();

  return (
    <>
      {!isPhysio && (
        <Card className="p-0 overflow-hidden">
          <div
            ref={expenseSectionRef}
            className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Despesas da clínica
              </h3>
              <p className="text-sm text-slate-500">
                Registre contas pagas ou vencimentos pendentes para acompanhar o que sai.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Pagas no período</p>
                <p className="font-bold text-rose-600">
                  {currencyFormatter.format(expensePeriodTotals.paidExpenses)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Em aberto no período</p>
                <p className="font-bold text-amber-600">
                  {currencyFormatter.format(expensePeriodTotals.openExpenses)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Histórico financeiro
                </h4>
                <p className="text-xs text-slate-500">
                  Por padrão, mostrando despesas dos últimos 30 dias.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  De
                  <input
                    type="date"
                    value={expenseStartDate}
                    onChange={(event) => {
                      setExpenseStartDate(event.target.value);
                      setExpenseViewFilter("period");
                    }}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Até
                  <input
                    type="date"
                    value={expenseEndDate}
                    onChange={(event) => {
                      setExpenseEndDate(event.target.value);
                      setExpenseViewFilter("period");
                    }}
                    className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <div className="flex flex-col gap-2 self-end sm:flex-row">
                  <Button
                    type="button"
                    variant={expenseViewFilter === "payable" ? "secondary" : "outline"}
                    className="gap-2"
                    onClick={() => setExpenseViewFilter("payable")}
                  >
                    <AlertTriangle size={16} />
                    A pagar
                  </Button>
                  <Button
                    type="button"
                    variant={expenseViewFilter === "period" ? "secondary" : "outline"}
                    onClick={resetExpensePeriod}
                  >
                    Últimos 30 dias
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {expenseReminders.length > 0 && (
            <div className="border-b border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle size={16} />
                Despesas para pagar nos próximos {expenseReminderDays} dias
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {expenseReminders.slice(0, 6).map((transaction) => {
                  const tone = getExpenseReminderTone(transaction);

                  return (
                    <div
                      key={transaction.id}
                      className={clsx(
                        "rounded-lg border bg-white p-3 text-sm dark:bg-slate-950",
                        tone === "overdue"
                          ? "border-rose-200 text-rose-800 dark:border-rose-900/50 dark:text-rose-300"
                          : "border-amber-200 text-amber-900 dark:border-amber-900/50 dark:text-amber-300",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {transaction.category}
                          </p>
                          <p className="text-xs opacity-80">
                            {getExpenseReminderLabel(transaction)} -{" "}
                            {formatDate(transaction.due_date)}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold">
                          {currencyFormatter.format(money(transaction.amount))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-0">
            <form
              onSubmit={handleRegisterExpense}
              className="p-6 border-b xl:border-b-0 xl:border-r border-slate-100 dark:border-slate-800 space-y-4"
            >
              <input
                type="file"
                ref={attachmentInputRef}
                className="hidden"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleAttachExpenseDocument}
              />
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valor
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Ex.: 1000"
                  autoComplete="off"
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  value={expenseForm.amount}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      amount: parseCurrencyValue(event.target.value),
                    }))
                  }
                />
                <p className="mt-2 text-sm text-slate-500">
                  Valor mostrado: {formatBRLValue(expenseForm.amount) || "R$ 0,00"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Categoria
                </label>
                <select
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  value={expenseForm.category}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                >
                  {expenseCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Data de pagamento ou vencimento
                  </label>
                  <input
                    type="date"
                    required
                    className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    value={expenseForm.dueDate}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    value={expenseForm.status}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        status: event.target.value as TransactionStatus,
                      }))
                    }
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  value={expenseForm.description}
                  onChange={(event) =>
                    setExpenseForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              {supportsTransactionAttachments ? (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Documento
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    className="mt-2 w-full text-sm text-slate-700 dark:text-slate-200"
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        document:
                          event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  {expenseForm.document && (
                    <p className="mt-2 text-xs text-slate-500">
                      Arquivo selecionado: {expenseForm.document.name}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  O banco de dados ainda não suporta anexos para despesas.
                </div>
              )}
              <Button type="submit" className="w-full gap-2" isLoading={saving}>
                <PlusCircle size={16} />
                Lançar despesa
              </Button>
            </form>

            <div className="mobile-card-table max-h-[520px] overflow-auto overscroll-contain xl:max-h-[640px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Data</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Categoria</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Status</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Descrição</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Documento</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Valor</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 dark:bg-slate-900">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredExpenseTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        {expenseViewFilter === "payable"
                          ? "Nenhuma despesa em aberto para pagar nos próximos dias."
                          : "Nenhuma despesa encontrada neste período."}
                      </td>
                    </tr>
                  ) : (
                    filteredExpenseTransactions.map((transaction) => {
                      const effectiveStatus =
                        getEffectiveTransactionStatus(transaction);

                      return (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 text-sm text-slate-500" data-label="Data">
                            {formatDate(transaction.due_date)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold" data-label="Categoria">
                            {transaction.category}
                          </td>
                          <td className="px-6 py-4" data-label="Status">
                            <Badge
                              variant={badgeVariantForTransaction(
                                effectiveStatus,
                              )}
                            >
                              {transactionStatusLabel[effectiveStatus]}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500" data-label="Descrição">
                            {transaction.description ?? "-"}
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
                          <td className="px-6 py-4 text-sm font-bold text-rose-600" data-label="Valor">
                            -{currencyFormatter.format(money(transaction.amount))}
                          </td>
                          <td className="px-6 py-4" data-label="Ações">
                            <div className="flex flex-wrap gap-2">
                              {effectiveStatus !== "paid" &&
                                effectiveStatus !== "cancelled" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleMarkExpensePaid(transaction)
                                    }
                                    disabled={saving}
                                  >
                                    <Check size={14} />
                                    Marcar pago
                                  </Button>
                                )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleOpenAttachmentUploader(transaction)
                                }
                                disabled={saving || !supportsTransactionAttachments}
                              >
                                {transaction.attachments?.[0]
                                  ? "Alterar anexo"
                                  : "Anexar documento"}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  handleDeleteExpense(transaction)
                                }
                                disabled={saving}
                              >
                                <Trash2 size={14} />
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};
