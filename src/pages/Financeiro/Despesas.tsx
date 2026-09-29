import { useMemo } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  FileUp,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StorageFileLink } from "../../components/ui/StorageFileLink";
import {
  ExpenseViewFilter,
  TransactionRow,
  currencyFormatter,
  expenseCategories,
  expenseReminderDays,
  formatBRLValue,
  formatDate,
  getEffectiveTransactionStatus,
  getExpenseReminderLabel,
  money,
  parseCurrencyValue,
  todayDate,
  useFinancial,
} from "./financialCore";

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const FILTERS: Array<{ value: ExpenseViewFilter; label: string }> = [
  { value: "payable", label: "A pagar" },
  { value: "paid", label: "Pagas" },
  { value: "period", label: "Todas" },
];

const inputClass =
  "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none";
const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

function daysUntil(date: string): number {
  const start = new Date(`${todayDate()}T12:00:00`).getTime();
  return Math.round((new Date(`${date}T12:00:00`).getTime() - start) / 86_400_000);
}

export const FinancialExpenses = () => {
  const {
    isPhysio,
    saving,
    error,
    expenseTransactions,
    filteredExpenseTransactions,
    expenseViewFilter,
    setExpenseViewFilter,
    expenseStartDate,
    setExpenseStartDate,
    expenseEndDate,
    setExpenseEndDate,
    expenseFormOpen,
    setExpenseFormOpen,
    setError,
    supportsTransactionAttachments,
    attachmentInputRef,
    handleAttachExpenseDocument,
  } = useFinancial();

  // Resumo do topo: olha todas as despesas, não só as do filtro.
  const summary = useMemo(() => {
    const open = expenseTransactions.filter((transaction) => {
      const status = getEffectiveTransactionStatus(transaction);
      return status !== "paid" && status !== "cancelled";
    });
    const overdue = open.filter((transaction) => daysUntil(transaction.due_date) < 0);
    const upcoming = open.filter((transaction) => {
      const days = daysUntil(transaction.due_date);
      return days >= 0 && days <= expenseReminderDays;
    });
    const paid = expenseTransactions.filter(
      (transaction) =>
        transaction.status === "paid" &&
        (!expenseStartDate || transaction.due_date >= expenseStartDate) &&
        (!expenseEndDate || transaction.due_date <= expenseEndDate),
    );
    const sum = (items: TransactionRow[]) => items.reduce((total, item) => total + money(item.amount), 0);
    return {
      overdue: { count: overdue.length, amount: sum(overdue) },
      upcoming: { count: upcoming.length, amount: sum(upcoming) },
      paid: { count: paid.length, amount: sum(paid) },
    };
  }, [expenseEndDate, expenseStartDate, expenseTransactions]);

  const listTotal = filteredExpenseTransactions.reduce((total, item) => total + money(item.amount), 0);

  if (isPhysio) return null;

  const openForm = () => {
    setError(null);
    setExpenseFormOpen(true);
  };

  return (
    <>
      {/* input escondido usado por "Anexar documento" de cada despesa */}
      <input
        type="file"
        ref={attachmentInputRef}
        className="hidden"
        accept=".pdf,image/png,image/jpeg"
        onChange={handleAttachExpenseDocument}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          tone="danger"
          icon={AlertTriangle}
          label="Vencidas"
          amount={summary.overdue.amount}
          detail={summary.overdue.count ? `${summary.overdue.count} ${summary.overdue.count === 1 ? "conta" : "contas"}` : "Nenhuma"}
          onClick={() => setExpenseViewFilter("payable")}
        />
        <SummaryCard
          tone="warning"
          icon={CalendarClock}
          label={`Vencem em ${expenseReminderDays} dias`}
          amount={summary.upcoming.amount}
          detail={summary.upcoming.count ? `${summary.upcoming.count} ${summary.upcoming.count === 1 ? "conta" : "contas"}` : "Nenhuma"}
          onClick={() => setExpenseViewFilter("payable")}
        />
        <SummaryCard
          tone="neutral"
          icon={CheckCircle2}
          label="Pagas no período"
          amount={summary.paid.amount}
          detail={`${formatDate(expenseStartDate)} a ${formatDate(expenseEndDate)}`}
          onClick={() => setExpenseViewFilter("paid")}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={expenseViewFilter === filter.value}
                  onClick={() => setExpenseViewFilter(filter.value)}
                  className={clsx(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    expenseViewFilter === filter.value
                      ? "bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {expenseViewFilter === "payable" ? (
              <p className="text-xs text-slate-500">Vencidas e as que vencem nos próximos 30 dias.</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <input
                  type="date"
                  aria-label="De"
                  value={expenseStartDate}
                  onChange={(event) => setExpenseStartDate(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                />
                <span>até</span>
                <input
                  type="date"
                  aria-label="Até"
                  value={expenseEndDate}
                  onChange={(event) => setExpenseEndDate(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>
            )}
          </div>
          <Button className="gap-2 lg:shrink-0" onClick={openForm}>
            <Plus size={18} /> Nova despesa
          </Button>
        </div>

        {filteredExpenseTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-500">
              {expenseViewFilter === "payable"
                ? "Nenhuma conta a pagar. Tudo em dia!"
                : "Nenhuma despesa neste período."}
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openForm}>
              <Plus size={16} /> Lançar uma despesa
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExpenseTransactions.map((transaction) => (
                <ExpenseRow key={transaction.id} transaction={transaction} />
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm sm:px-5 dark:border-slate-800 dark:bg-slate-900/50">
              <span className="text-slate-500">
                {filteredExpenseTransactions.length}{" "}
                {filteredExpenseTransactions.length === 1 ? "despesa" : "despesas"}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                Total: {currencyFormatter.format(listTotal)}
              </span>
            </div>
          </>
        )}
      </Card>

      {expenseFormOpen && (
        <NewExpenseModal
          saving={saving}
          error={error}
          supportsAttachments={supportsTransactionAttachments}
          onClose={() => setExpenseFormOpen(false)}
        />
      )}
    </>
  );
};

const SummaryCard = ({
  tone,
  icon: Icon,
  label,
  amount,
  detail,
  onClick,
}: {
  tone: "danger" | "warning" | "neutral";
  icon: typeof AlertTriangle;
  label: string;
  amount: number;
  detail: string;
  onClick: () => void;
}) => {
  const active = amount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:shadow-sm sm:items-start sm:py-4",
        tone === "danger" && active && "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20",
        tone === "warning" && active && "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
        (!active || tone === "neutral") && "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p
          className={clsx(
            "mt-0.5 text-lg font-bold sm:mt-1 sm:text-xl",
            tone === "danger" && active ? "text-rose-700 dark:text-rose-300" : tone === "warning" && active ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white",
          )}
        >
          {currencyFormatter.format(amount)}
        </p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
      <Icon
        size={22}
        className={clsx(
          tone === "danger" && active ? "text-rose-500" : tone === "warning" && active ? "text-amber-500" : "text-slate-400",
        )}
      />
    </button>
  );
};

const ExpenseRow = ({ transaction }: { transaction: TransactionRow }) => {
  const {
    saving,
    supportsTransactionAttachments,
    handleMarkExpensePaid,
    handleOpenAttachmentUploader,
    handleDeleteExpense,
  } = useFinancial();
  const status = getEffectiveTransactionStatus(transaction);
  const isOpen = status !== "paid" && status !== "cancelled";
  const [, month, day] = transaction.due_date.split("-");
  const attachment = transaction.attachments?.[0];

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5">
      <div
        className={clsx(
          "flex w-12 shrink-0 flex-col items-center rounded-lg border py-1 leading-tight",
          status === "overdue"
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30"
            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900",
        )}
      >
        <span className="text-base font-bold">{day}</span>
        <span className="text-[10px] font-semibold">{MONTHS_SHORT[Number(month) - 1]}</span>
      </div>

      {/* No celular: título em cima; situação, valor e ações embaixo. */}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {transaction.category}
            {transaction.description && (
              <span className="font-normal text-slate-500"> · {transaction.description}</span>
            )}
          </p>
          <p
            className={clsx(
              "text-xs font-medium",
              status === "paid" && "text-emerald-600",
              status === "overdue" && "text-rose-600",
              status === "pending" && "text-amber-600",
              status === "cancelled" && "text-slate-400",
            )}
          >
            {status === "paid"
              ? "Paga"
              : status === "cancelled"
                ? "Cancelada"
                : getExpenseReminderLabel(transaction)}
          </p>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-0 sm:justify-end">
          <p className="shrink-0 text-sm font-bold text-rose-600">
            -{currencyFormatter.format(money(transaction.amount))}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {isOpen && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => handleMarkExpensePaid(transaction)}
                disabled={saving}
                title="Marcar como paga"
              >
                <Check size={14} />
                Pagar
              </Button>
            )}
            {attachment ? (
              <StorageFileLink
                bucket="transaction-docs"
                value={attachment}
                className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                title="Ver documento"
              >
                <Paperclip size={16} />
              </StorageFileLink>
            ) : (
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"
                onClick={() => handleOpenAttachmentUploader(transaction)}
                disabled={saving || !supportsTransactionAttachments}
                title="Anexar documento"
                aria-label="Anexar documento"
              >
                <FileUp size={16} />
              </button>
            )}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/30"
              onClick={() => handleDeleteExpense(transaction)}
              disabled={saving}
              title="Excluir despesa"
              aria-label="Excluir despesa"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

const NewExpenseModal = ({
  saving,
  error,
  supportsAttachments,
  onClose,
}: {
  saving: boolean;
  error: string | null;
  supportsAttachments: boolean;
  onClose: () => void;
}) => {
  const { expenseForm, setExpenseForm, handleRegisterExpense } = useFinancial();
  const paid = expenseForm.status === "paid";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nova despesa</h2>
            <p className="text-sm text-slate-500">Conta paga ou a pagar da clínica.</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleRegisterExpense} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>Valor</label>
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                placeholder="0,00"
                autoComplete="off"
                className={clsx(inputClass, "text-lg font-semibold")}
                value={expenseForm.amount ? formatBRLValue(expenseForm.amount) : ""}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, amount: parseCurrencyValue(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Categoria</label>
              <select
                className={inputClass}
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
              >
                {expenseCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Situação</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {([
                ["paid", "Já foi paga"],
                ["pending", "Ainda vou pagar"],
              ] as const).map(([value, label]) => {
                const selected = value === "paid" ? paid : !paid;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setExpenseForm((current) => ({ ...current, status: value }))}
                    className={clsx(
                      "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                      selected
                        ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-900/20 dark:text-brand-300"
                        : "border-slate-200 text-slate-600 hover:border-brand-300 dark:border-slate-800 dark:text-slate-300",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>{paid ? "Pago em" : "Vence em"}</label>
            <input
              type="date"
              required
              className={inputClass}
              value={expenseForm.dueDate}
              onChange={(event) => setExpenseForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>
              Descrição <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ex.: aluguel de outubro"
              value={expenseForm.description}
              onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>

          {supportsAttachments && (
            <div className="space-y-2">
              <label className={labelClass}>
                Comprovante ou boleto <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700">
                <FileUp size={18} className="shrink-0" />
                <span className="truncate">
                  {expenseForm.document ? expenseForm.document.name : "Escolher arquivo (PDF, PNG ou JPG)"}
                </span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) =>
                    setExpenseForm((current) => ({ ...current, document: event.target.files?.[0] ?? null }))
                  }
                />
              </label>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-[2] gap-2" isLoading={saving}>
              <Plus size={16} /> Salvar despesa
            </Button>
          </div>
        </form>
      </Card>
    </div>,
    document.body,
  );
};
