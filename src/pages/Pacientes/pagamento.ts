/*
  Regras da pergunta "Como o paciente pagou?" no cadastro, renovação e
  contratação de procedimentos. Traduz a escolha para os campos que o
  salvamento já usa (amount_paid, payment_method, installments...).
*/
import {
  CREDIT_CARD_METHOD,
  describePaymentMethod,
} from "../../lib/payments";
import type { NewPatientForm } from "./types";

export type PaymentPlan = {
  receivedToday: number;
  methodLabel: string;
  /** Parcelas que ficam para receber. */
  pending: Array<{ number: number; amount: number; dueDate: string }>;
  /** Parcelas da maquininha (paciente já quitado). */
  fromCardMachine: boolean;
};

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addMonthsIso(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/** Mesma divisão usada ao gerar as parcelas: a última absorve os centavos. */
export function splitAmount(total: number, count: number): number[] {
  if (total <= 0 || count < 1) return [];
  const base = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? roundMoney(total - base * (count - 1)) : base,
  );
}

export function isCardMonthly(form: NewPatientForm): boolean {
  return (
    form.payment_mode === "paid_full" &&
    form.payment_method === CREDIT_CARD_METHOD &&
    form.card_installments > 1 &&
    form.card_settlement === "monthly"
  );
}

/** Vencimento sugerido quando a pessoa escolhe uma opção. */
export function defaultFirstDueDate(form: NewPatientForm, mode: NewPatientForm["payment_mode"], cardMonthly = false): string {
  if (cardMonthly) return addMonthsIso(todayIso(), 1);
  if (mode === "installments" || mode === "unpaid") return form.plan_start_date || todayIso();
  return "";
}

export function buildPaymentPlan(form: NewPatientForm, total: number): PaymentPlan {
  const empty: PaymentPlan = { receivedToday: 0, methodLabel: "", pending: [], fromCardMachine: false };
  if (total <= 0 || !form.payment_mode) return empty;

  const firstDue = form.first_due_date || form.plan_start_date || todayIso();
  const toPending = (amount: number, count: number) =>
    splitAmount(amount, count).map((value, index) => ({
      number: index + 1,
      amount: value,
      dueDate: addMonthsIso(firstDue, index),
    }));

  if (form.payment_mode === "paid_full") {
    const methodLabel = describePaymentMethod(form.payment_method, form.card_installments);
    if (isCardMonthly(form)) {
      return {
        receivedToday: 0,
        methodLabel,
        pending: toPending(total, form.card_installments),
        fromCardMachine: true,
      };
    }
    return { receivedToday: total, methodLabel, pending: [], fromCardMachine: false };
  }

  if (form.payment_mode === "installments") {
    const entry = Math.min(Math.max(Number(form.amount_paid) || 0, 0), total);
    return {
      receivedToday: entry,
      methodLabel: entry > 0 ? form.payment_method : "",
      pending: toPending(roundMoney(total - entry), Math.max(Number(form.installments) || 1, 1)),
      fromCardMachine: false,
    };
  }

  return { receivedToday: 0, methodLabel: "", pending: toPending(total, 1), fromCardMachine: false };
}

/** Mensagem de erro, ou null se a escolha está completa. */
export function validatePaymentChoice(form: NewPatientForm, total: number): string | null {
  if (total <= 0) return null;
  if (!form.payment_mode) {
    return "Escolha como o paciente pagou (em Financeiro, no fim do formulário).";
  }
  if (form.payment_mode === "paid_full") {
    if (!form.payment_method) return "Escolha a forma de pagamento.";
    if (isCardMonthly(form) && !form.first_due_date) {
      return "Informe quando cai a primeira parcela do cartão.";
    }
  }
  if (form.payment_mode === "installments") {
    const entry = Number(form.amount_paid) || 0;
    if (entry >= total) {
      return 'A entrada cobre o valor total. Escolha "Pagou tudo agora".';
    }
    if (entry > 0 && !form.payment_method) return "Escolha a forma de pagamento da entrada.";
    if ((Number(form.installments) || 0) < 1) return "Informe em quantas parcelas o paciente vai pagar.";
    if (!form.first_due_date) return "Informe o vencimento da primeira parcela.";
  }
  if (form.payment_mode === "unpaid" && !form.first_due_date) {
    return "Informe até quando o paciente deve pagar.";
  }
  return null;
}

/** Converte a escolha nos campos que o salvamento usa. */
export function applyPaymentChoice(form: NewPatientForm, total: number): NewPatientForm {
  if (total <= 0) {
    return { ...form, amount_paid: 0, installments: 1, payment_status: "pendente", installments_channel: "patient" };
  }

  const plan = buildPaymentPlan(form, total);
  const paidInFull = plan.receivedToday >= total || plan.fromCardMachine;

  if (form.payment_mode === "paid_full") {
    return {
      ...form,
      amount_paid: plan.receivedToday,
      payment_method: plan.methodLabel,
      installments: plan.fromCardMachine ? form.card_installments : 1,
      installments_channel: plan.fromCardMachine ? "card_machine" : "patient",
      first_due_date: plan.fromCardMachine ? form.first_due_date : "",
      payment_status: paidInFull && !plan.fromCardMachine ? "pago" : "pendente",
    };
  }

  if (form.payment_mode === "installments") {
    return {
      ...form,
      amount_paid: plan.receivedToday,
      payment_method: plan.receivedToday > 0 ? form.payment_method : "",
      installments: Math.max(Number(form.installments) || 1, 1),
      installments_channel: "patient",
      payment_status: "pendente",
    };
  }

  return {
    ...form,
    amount_paid: 0,
    payment_method: "",
    installments: 1,
    installments_channel: "patient",
    payment_status: "pendente",
  };
}
