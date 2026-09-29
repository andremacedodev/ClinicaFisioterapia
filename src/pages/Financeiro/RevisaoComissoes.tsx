import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  CommissionPayment,
  currencyFormatter,
  formatDate,
  money,
  useFinancial,
} from "./financialCore";

type Professional = { id: string; full_name: string };
type Choice = { month: string; professionalId: string };

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

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sugere a profissional pelo primeiro nome escrito na descrição (se só uma bater). */
function guessProfessional(
  description: string | null | undefined,
  professionals: Professional[],
): string {
  if (!description) return "";
  const words = new Set(normalize(description).split(/[^a-z0-9]+/).filter(Boolean));
  const matches = professionals.filter((professional) => {
    const firstName = normalize(professional.full_name).split(/\s+/)[0];
    return firstName && words.has(firstName);
  });
  return matches.length === 1 ? matches[0].id : "";
}

/** Pago até o dia 10: provavelmente comissão do mês anterior. */
function suggestedMonth(payment: CommissionPayment): string {
  const paidMonth = payment.paid_at.slice(0, 7);
  return Number(payment.paid_at.slice(8, 10)) <= 10 ? shiftMonth(paidMonth, -1) : paidMonth;
}

/**
 * Pagamentos de comissão feitos antes do período de referência existir.
 * Foram migrados como referentes ao mês em que foram pagos (alguns sem
 * profissional identificado); aqui a administradora confirma cada um.
 */
export const CommissionPaymentsReview = () => {
  const { profile } = useAuth();
  const { commissionPayments, handleConfirmCommissionPayment, saving } = useFinancial();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const pending = useMemo(
    () =>
      commissionPayments
        .filter((payment) => payment.needs_review)
        .sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
    [commissionPayments],
  );

  useEffect(() => {
    if (!profile?.clinic_id || pending.length === 0) return;
    let active = true;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", profile.clinic_id)
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        if (active) setProfessionals((data ?? []) as Professional[]);
      });
    return () => {
      active = false;
    };
  }, [profile?.clinic_id, pending.length]);

  useEffect(() => {
    setChoices((current) => {
      const next = { ...current };
      for (const payment of pending) {
        const previous = next[payment.id];
        next[payment.id] = {
          month: previous?.month ?? suggestedMonth(payment),
          professionalId:
            previous?.professionalId ||
            payment.professional_id ||
            guessProfessional(payment.description, professionals),
        };
      }
      return next;
    });
  }, [pending, professionals]);

  if (pending.length === 0) return null;

  const setChoice = (paymentId: string, change: Partial<Choice>) =>
    setChoices((current) => ({
      ...current,
      [paymentId]: { ...current[paymentId], ...change },
    }));

  const allChosen = pending.every((payment) => choices[payment.id]?.professionalId);

  const saveAll = async () => {
    for (const payment of pending) {
      const choice = choices[payment.id];
      if (choice?.professionalId) {
        await handleConfirmCommissionPayment(payment, choice.month, choice.professionalId);
      }
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
              se referia, e alguns foram lançados só com o primeiro nome. Confira a
              profissional e o mês de cada um. As opções já vêm com uma sugestão
              (pagamentos até o dia 10 costumam ser do mês anterior). Nada muda nos
              relatórios até você salvar.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button size="sm" disabled={saving || !allChosen} onClick={saveAll}>
            Salvar todos
          </Button>
          {!allChosen && (
            <span className="ml-3 text-xs text-amber-700">
              Escolha a profissional de todas as linhas para salvar todos.
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Pago em</th>
              <th className="px-6 py-4">Descrição</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4">Fisioterapeuta</th>
              <th className="px-6 py-4">Referente a</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((payment) => {
              const paidMonth = payment.paid_at.slice(0, 7);
              const choice = choices[payment.id] ?? {
                month: suggestedMonth(payment),
                professionalId: payment.professional_id ?? "",
              };
              const months = [0, -1, -2].map((delta) => shiftMonth(paidMonth, delta));
              if (!months.includes(choice.month)) months.push(choice.month);

              return (
                <tr key={payment.id}>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(payment.paid_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-[16rem]">
                    {payment.description || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    {currencyFormatter.format(money(payment.amount))}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                      value={choice.professionalId}
                      onChange={(event) =>
                        setChoice(payment.id, { professionalId: event.target.value })
                      }
                    >
                      <option value="">Escolha...</option>
                      {professionals.map((professional) => (
                        <option key={professional.id} value={professional.id}>
                          {professional.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                      value={choice.month}
                      onChange={(event) => setChoice(payment.id, { month: event.target.value })}
                    >
                      {months.map((month) => (
                        <option key={month} value={month}>
                          {monthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      size="sm"
                      disabled={saving || !choice.professionalId}
                      onClick={() =>
                        handleConfirmCommissionPayment(
                          payment,
                          choice.month,
                          choice.professionalId,
                        )
                      }
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
