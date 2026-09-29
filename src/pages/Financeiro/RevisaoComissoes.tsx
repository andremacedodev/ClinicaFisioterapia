import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  CommissionPayment,
  currencyFormatter,
  formatDate,
  money,
  useFinancial,
} from "./financialCore";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = MONTH_LABEL.format(new Date(year, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Pagamentos de comissão feitos antes do período de referência existir.
 * Foram migrados como referentes ao mês em que foram pagos; aqui a
 * administradora confirma ou corrige o mês de cada um.
 */
export const CommissionPaymentsReview = () => {
  const { commissionPayments, handleConfirmCommissionPaymentPeriod, saving } =
    useFinancial();
  const pending = useMemo(
    () =>
      commissionPayments
        .filter((payment) => payment.needs_review)
        .sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
    [commissionPayments],
  );
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setChoices((current) => {
      const next = { ...current };
      for (const payment of pending) {
        next[payment.id] ??= payment.period_start.slice(0, 7);
      }
      return next;
    });
  }, [pending]);

  if (pending.length === 0) return null;

  const saveAll = async (pick: (payment: CommissionPayment) => string) => {
    for (const payment of pending) {
      await handleConfirmCommissionPaymentPeriod(payment, pick(payment));
    }
  };

  return (
    <Card className="p-0 overflow-hidden border-amber-200">
      <div className="p-6 border-b border-amber-100 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-900/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Pagamentos antigos para revisar ({pending.length})
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Antes, o sistema não guardava a qual mês cada pagamento de comissão
              se referia e usava o mês em que ele foi pago. Confira cada um: se a
              comissão de março foi paga em abril, escolha março. Nada muda nos
              relatórios até você salvar.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => saveAll((payment) => shiftMonth(payment.paid_at.slice(0, 7), -1))}
          >
            Todos referentes ao mês anterior ao pagamento
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => saveAll((payment) => payment.paid_at.slice(0, 7))}
          >
            Todos referentes ao mês do pagamento
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Pago em</th>
              <th className="px-6 py-4">Fisioterapeuta</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4">Referente a</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((payment) => {
              const paidMonth = payment.paid_at.slice(0, 7);
              const options = [0, -1, -2].map((delta) => shiftMonth(paidMonth, delta));
              const choice = choices[payment.id] ?? payment.period_start.slice(0, 7);
              if (!options.includes(choice)) options.push(choice);

              return (
                <tr key={payment.id}>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(payment.paid_at)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {payment.profiles?.full_name ?? "Profissional"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {currencyFormatter.format(money(payment.amount))}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                      value={choice}
                      onChange={(event) =>
                        setChoices((current) => ({
                          ...current,
                          [payment.id]: event.target.value,
                        }))
                      }
                    >
                      {options.map((month) => (
                        <option key={month} value={month}>
                          {monthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => handleConfirmCommissionPaymentPeriod(payment, choice)}
                    >
                      Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
