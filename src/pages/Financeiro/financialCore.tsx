/*
  Estado, carregamento e ações do Financeiro, compartilhados pelas abas.
  A lógica veio de src/pages/Financial.tsx sem alterações.
*/
import { supabase } from "../../lib/supabase";
import {
  CARD_MACHINE_METHOD,
  CREDIT_CARD_METHOD,
  PAYMENT_METHODS,
  isCardMachineReceivable,
} from "../../lib/payments";
import type { CommissionWorkbookOptions } from "./planilhaComissoes";
import { useAuth } from "../../context/AuthContext";
import { ChangeEvent, FormEvent, ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CLINIC_HEADER_CSS, ClinicProfile, clinicHeaderHtml, fetchClinicProfile } from "../../lib/clinicProfile";
import { buildCommissionDetailReport, buildCommissionReport } from "../../lib/commission";
import { TrendingUp } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { clsx } from "clsx";

export type PaymentStatus = "pago" | "pendente";

export type InstallmentRow = {
  id: string;
  installment_number: number;
  amount: number | string;
  amount_paid: number | string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  status: PaymentStatus;
};

export type PackageRow = {
  id: string;
  patient_id: string;
  total_lessons: number;
  completed_lessons: number;
  missed_lessons: number;
  procedure_amount: number | string;
  total_amount: number | string;
  amount_paid: number | string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  installments: number;
  start_date: string;
  created_at: string;
  expected_end_date: string | null;
  status: "ativo" | "concluido" | "cancelado";
  patients: {
    full_name: string;
    phone: string | null;
    status: string;
    profiles: { full_name: string } | null;
  } | null;
  package_installments: InstallmentRow[];
};

export type CommissionAppointment = {
  id: string;
  patient_id: string | null;
  package_id: string | null;
  start_time: string;
  status: string;
  class_price: number | string | null;
  commission_amount: number | string | null;
  patients: {
    full_name: string;
    status: string;
    profiles?: { id: string; full_name: string } | null;
  } | null;
  profiles: { id: string; full_name: string } | null;
  lesson_packages: {
    total_lessons: number;
    lesson_value: number | string;
    procedure_amount: number | string;
    total_amount: number | string;
  } | null;
};

export type ProfessionalReport = {
  professionalId: string;
  professionalName: string;
  heldClasses: number;
  paidMisses: number;
  gross: number;
  professionalShare: number;
  commissionPaid: number;
};

export type CommissionDetailRow = {
  professionalId: string;
  professionalName: string;
  patientId: string;
  patientName: string;
  packageId: string;
  packageAmount: number;
  grossClassValue: number;
  commissionClassValue: number;
  contractedLessons: number;
  attendanceByDate: Record<string, string[]>;
  paidClasses: number;
  grossTotal: number;
  totalCommission: number;
};

export type CommissionPayment = {
  id: string;
  /** Vazio em pagamento antigo sem profissional identificado (em revisão). */
  professional_id: string | null;
  period_start: string;
  period_end: string;
  amount: number | string;
  paid_at: string;
  needs_review: boolean;
  transaction_id: string | null;
  profiles: { full_name: string } | null;
  description: string | null;
};

/**
 * Pagamentos de comissão com período de referência. Se o banco ainda não tem
 * a tabela (migration não aplicada), o app segue com o cálculo antigo.
 */
export async function fetchCommissionPayments(
  clinicId: string,
): Promise<{ supported: boolean; payments: CommissionPayment[]; error?: string }> {
  const { data, error } = await supabase
    .from("commission_payments")
    .select(
      "id, professional_id, period_start, period_end, amount, paid_at, needs_review, transaction_id, profiles (full_name), transactions (description)",
    )
    .eq("clinic_id", clinicId)
    .order("paid_at", { ascending: false });

  if (error) {
    const missingTable =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /commission_payments/.test(error.message);
    return missingTable
      ? { supported: false, payments: [] }
      : { supported: true, payments: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as (Omit<CommissionPayment, "description"> & {
    transactions: { description: string | null } | null;
  })[];
  return {
    supported: true,
    payments: rows.map(({ transactions, ...payment }) => ({
      ...payment,
      description: transactions?.description ?? null,
    })),
  };
}

export function monthRange(date: string): { startDate: string; endDate: string } {
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export type TransactionRow = {
  id: string;
  patient_id: string | null;
  package_id: string | null;
  amount: number | string;
  type: "income" | "expense";
  category: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  description: string | null;
  attachments?: string[] | null;
  due_date: string;
  created_at: string;
  patients: {
    full_name: string;
    status: string;
    profiles: { full_name: string } | null;
  } | null;
};

export type TransactionStatus = TransactionRow["status"];

export type ReceivableFilter = "open" | "card" | "paid" | "all";
export type DueSort = "asc" | "desc";
/** A pagar (próximos dias e vencidas), pagas no período ou todas do período. */
export type ExpenseViewFilter = "payable" | "paid" | "period";
export type ExpenseReminderTone = "overdue" | "today" | "soon";

export type FinancialReportSections = {
  payable: boolean;
  paid: boolean;
  receipts: boolean;
};

export type ExpenseFormState = {
  amount: string;
  category: string;
  description: string;
  dueDate: string;
  status: TransactionStatus;
  document: File | null;
};

export type ReceivableRow = {
  kind: "package";
  packageItem: PackageRow;
  installment: InstallmentRow;
  patientName: string;
  professionalName: string;
  remaining: number;
  status: PaymentStatus;
  /** Parcela que a maquininha do cartão deposita (não é dívida do paciente). */
  cardMachine: boolean;
};

export type ProcedureReceivableRow = {
  kind: "procedure";
  transaction: TransactionRow;
  patientName: string;
  professionalName: string;
  remaining: number;
  status: PaymentStatus;
  /** Parcela que a maquininha do cartão deposita (não é dívida do paciente). */
  cardMachine: boolean;
};

export type PackageReceiptReceivableRow = {
  kind: "package_receipt";
  transaction: TransactionRow;
  patientName: string;
  professionalName: string;
  remaining: number;
  status: PaymentStatus;
  /** Parcela que a maquininha do cartão deposita (não é dívida do paciente). */
  cardMachine: boolean;
};

export type ReceivableItem =
  | ReceivableRow
  | ProcedureReceivableRow
  | PackageReceiptReceivableRow;

export type PaymentTarget =
  | {
      kind: "package";
      packageItem: PackageRow;
      installment: InstallmentRow;
      /** Confirmação de depósito da maquininha (muda título e textos). */
      cardConfirmation?: boolean;
    }
  | {
      kind: "procedure";
      transaction: TransactionRow;
      cardConfirmation?: boolean;
    };

/** Pacote antigo registrado no cartão que ainda tem parcelas em aberto. */
export type LegacyCardPackage = {
  packageItem: PackageRow;
  firstOpenInstallment: InstallmentRow;
  openAmount: number;
  openCount: number;
};

/** Converte formas antigas/livres ("cartão crédito 3x", "pix") para a lista. */
export function paymentMethodForSelect(value: string | null | undefined): string {
  const normalized = normalizeSearchText(value);
  if (!normalized) return "Pix";
  if (normalized.includes("credito") || isCardMachineReceivable(value)) return CREDIT_CARD_METHOD;
  if (normalized.includes("debito")) return "Cartão de débito";
  return (
    PAYMENT_METHODS.find((method) => normalized.startsWith(normalizeSearchText(method))) ?? "Pix"
  );
}

export function looksLikeCreditCard(value: string | null | undefined): boolean {
  const normalized = normalizeSearchText(value);
  return normalized.includes("credito") || (normalized.includes("cartao") && !normalized.includes("debito"));
}

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const paymentLabel: Record<PaymentStatus, string> = {
  pago: "Pago",
  pendente: "Pendente",
};

export const transactionStatusLabel: Record<TransactionStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const expenseCategories = [
  "Aluguel",
  "Comissão fisioterapeuta",
  "Material clínico",
  "Limpeza",
  "Água",
  "Energia elétrica",
  "Internet",
  "Impostos",
  "Marketing",
  "Manutenção",
  "Outros",
];

export const expenseReminderDays = 7;
export const expensePayableWindowDays = 30;

export const initialExpenseForm = (): ExpenseFormState => ({
  amount: "",
  category: "Outros",
  description: "",
  dueDate: todayDate(),
  status: "paid",
  document: null,
});

export function money(value: number | string | null | undefined): number {
  return Number(value) || 0;
}

export function cents(value: number | string | null | undefined): number {
  return Math.round(money(value) * 100);
}

export function formatBRLValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";

  const normalized = digits.padStart(3, "0");
  const integerPart = normalized.slice(0, -2);
  const decimalPart = normalized.slice(-2);
  const amount = Number(`${integerPart}.${decimalPart}`);

  return currencyFormatter.format(amount);
}

export function parseCurrencyValue(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length <= 2) {
    return digits;
  }

  return digits.slice(0, -2) + "." + digits.slice(-2);
}

export async function uploadTransactionDocument(
  clinicId: string,
  file: File,
): Promise<string> {
  const path = `transaction-docs/${clinicId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("transaction-docs")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    throw new Error(`Erro no upload do documento: ${uploadError.message}`);
  }

  // O bucket é privado: guardamos o caminho e geramos link assinado ao abrir.
  return path;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function nextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  return (
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}

export function listDateRange(startDate: string, endDate: string): string[] {
  const days = Math.max(Math.min(daysBetweenInclusive(startDate, endDate), 31), 0);
  const start = parseDateInput(startDate);

  return Array.from({ length: days }, (_, index) =>
    toDateInputValue(addDays(start, index)),
  );
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00`)
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })
    .replace(".", "");
}

export function getDefaultCommissionPeriod(): { startDate: string; endDate: string } {
  const monthStart = startOfMonth(new Date());
  const monthEnd = addDays(nextMonth(monthStart), -1);

  return {
    startDate: toDateInputValue(monthStart),
    endDate: toDateInputValue(monthEnd),
  };
}

export function getDefaultExpensePeriod(): { startDate: string; endDate: string } {
  const today = new Date();

  return {
    startDate: toDateInputValue(addDays(today, -29)),
    endDate: toDateInputValue(today),
  };
}

export function statusFromPayment(total: number, paid: number): PaymentStatus {
  const totalCents = cents(total);
  const paidCents = cents(paid);

  if (paidCents <= 0) return "pendente";
  if (paidCents >= totalCents) return "pago";
  return "pendente";
}

export function getInstallments(packageItem: PackageRow): InstallmentRow[] {
  return [...(packageItem.package_installments ?? [])].sort(
    (a, b) => a.installment_number - b.installment_number,
  );
}

export function getCurrentInstallment(packageItem: PackageRow): InstallmentRow | null {
  return (
    getInstallments(packageItem).find(
      (item) => getRemainingInstallment(item) > 0,
    ) ?? null
  );
}

export function getRemainingInstallment(installment: InstallmentRow): number {
  return (
    Math.max(cents(installment.amount) - cents(installment.amount_paid), 0) /
    100
  );
}

export function getInstallmentPaymentStatus(
  installment: InstallmentRow,
): PaymentStatus {
  const status = statusFromPayment(
    money(installment.amount),
    money(installment.amount_paid),
  );

  if (status === "pago") return "pago";
  return "pendente";
}

export function paymentStatusFromTransaction(
  status: TransactionStatus,
): PaymentStatus {
  if (status === "paid") return "pago";
  return "pendente";
}

export function badgeVariantForPayment(status: PaymentStatus) {
  if (status === "pago") return "success";
  return "warning";
}

export function badgeVariantForTransaction(status: TransactionStatus) {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "cancelled") return "neutral";
  return "warning";
}

export function getEffectiveTransactionStatus(
  transaction: TransactionRow,
): TransactionStatus {
  if (
    transaction.type === "expense" &&
    transaction.status === "pending" &&
    transaction.due_date < todayDate()
  ) {
    return "overdue";
  }

  return transaction.status;
}

export function getDaysUntil(date: string): number {
  const today = parseDateInput(todayDate());
  const target = parseDateInput(date);

  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function getExpenseReminderTone(transaction: TransactionRow): ExpenseReminderTone {
  const daysUntil = getDaysUntil(transaction.due_date);

  if (daysUntil < 0 || transaction.status === "overdue") return "overdue";
  if (daysUntil === 0) return "today";
  return "soon";
}

export function getExpenseReminderLabel(transaction: TransactionRow): string {
  const daysUntil = getDaysUntil(transaction.due_date);

  if (daysUntil < 0) {
    const daysLate = Math.abs(daysUntil);
    return `Vencida há ${daysLate} ${daysLate === 1 ? "dia" : "dias"}`;
  }

  if (daysUntil === 0) return "Vence hoje";
  if (daysUntil === 1) return "Vence amanhã";

  return `Vence em ${daysUntil} dias`;
}

export function isStandaloneProcedureIncome(transaction: TransactionRow): boolean {
  return (
    transaction.type === "income" &&
    transaction.category === "Recebimento de procedimentos"
  );
}

export function isInitialPackageReceipt(transaction: TransactionRow): boolean {
  return (
    transaction.type === "income" &&
    transaction.category === "Recebimento de pacote" &&
    /^Recebimento inicial(?: da renovação)?\b/i.test(
      transaction.description ?? "",
    )
  );
}

export function dedupeProcedureTransactions(
  transactions: TransactionRow[],
): TransactionRow[] {
  const seen = new Set<string>();

  return transactions.filter((transaction) => {
    if (!isStandaloneProcedureIncome(transaction)) return true;

    const key = [
      transaction.patient_id ?? transaction.description ?? transaction.id,
      transaction.type,
      transaction.category,
      transaction.status,
      transaction.due_date,
      cents(transaction.amount),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function cleanProcedurePaymentDescription(value: string): string {
  return value.replace(/\s+-\s+saldo em aberto$/i, "");
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesPatientSearch(
  patientName: string | null | undefined,
  searchTerm: string,
): boolean {
  const normalizedSearch = normalizeSearchText(searchTerm);
  if (!normalizedSearch) return true;

  return normalizeSearchText(patientName).includes(normalizedSearch);
}

export function getPatientProfessionalName(
  patient: { profiles: { full_name: string } | null } | null,
): string {
  return patient?.profiles?.full_name ?? "Sem fisioterapeuta";
}

export function getAppointmentResponsibleProfessional(
  appointment: CommissionAppointment,
): { id: string; full_name: string } {
  const responsible = appointment.patients?.profiles;
  if (responsible?.id || responsible?.full_name) {
    return {
      id: responsible.id ?? "sem-profissional",
      full_name: responsible.full_name ?? "Sem profissional definido",
    };
  }

  return {
    id: appointment.profiles?.id ?? "sem-profissional",
    full_name: appointment.profiles?.full_name ??
      "Sem profissional definido",
  };
}

export function useFinancialController() {
  const { profile } = useAuth();
  const [clinicProfile, setClinicProfile] = useState<ClinicProfile | null>(null);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    let active = true;
    fetchClinicProfile(profile.clinic_id)
      .then((data) => active && setClinicProfile(data))
      .catch((error) => console.warn("Dados da clínica indisponíveis:", error));
    return () => {
      active = false;
    };
  }, [profile?.clinic_id]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [appointments, setAppointments] = useState<CommissionAppointment[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(
    null,
  );
  const [commissionTarget, setCommissionTarget] =
    useState<ProfessionalReport | null>(null);
  const [commissionPayments, setCommissionPayments] = useState<CommissionPayment[]>([]);
  const [supportsCommissionPayments, setSupportsCommissionPayments] = useState(false);
  const [commissionPaymentAmount, setCommissionPaymentAmount] = useState("");
  const [commissionPaidAt, setCommissionPaidAt] = useState(todayDate);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [paymentReceivedDate, setPaymentReceivedDate] = useState(todayDate);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [receivableFilter, setReceivableFilter] =
    useState<ReceivableFilter>("open");
  const [dueSort, setDueSort] = useState<DueSort>("asc");
  const [expenseViewFilter, setExpenseViewFilter] =
    useState<ExpenseViewFilter>("payable");
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportsTransactionAttachments, setSupportsTransactionAttachments] = useState(true);
  const [attachmentTarget, setAttachmentTarget] = useState<TransactionRow | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [expenseStartDate, setExpenseStartDate] = useState(
    () => getDefaultExpensePeriod().startDate,
  );
  const [expenseEndDate, setExpenseEndDate] = useState(
    () => getDefaultExpensePeriod().endDate,
  );
  const [historyStartDate, setHistoryStartDate] = useState(
    () => getDefaultExpensePeriod().startDate,
  );
  const [historyEndDate, setHistoryEndDate] = useState(
    () => getDefaultExpensePeriod().endDate,
  );
  const [financialReportOpen, setFinancialReportOpen] = useState(false);
  const [financialReportStartDate, setFinancialReportStartDate] = useState(
    () => getDefaultCommissionPeriod().startDate,
  );
  const [financialReportEndDate, setFinancialReportEndDate] = useState(
    () => getDefaultCommissionPeriod().endDate,
  );
  const [financialReportSections, setFinancialReportSections] =
    useState<FinancialReportSections>({
      payable: true,
      paid: true,
      receipts: true,
    });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() =>
    initialExpenseForm(),
  );
  const expenseSectionRef = useRef<HTMLDivElement | null>(null);
  const isPhysio = profile?.role === "physio";
  const isAdmin = profile?.role === "admin";
  const hasPatientSearch = Boolean(normalizeSearchText(patientSearchTerm));

  const scrollToExpense = () => {
    expenseSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const resetExpensePeriod = () => {
    const defaultPeriod = getDefaultExpensePeriod();
    setExpenseStartDate(defaultPeriod.startDate);
    setExpenseEndDate(defaultPeriod.endDate);
    setExpenseViewFilter("period");
  };

  const resetHistoryPeriod = () => {
    const defaultPeriod = getDefaultExpensePeriod();
    setHistoryStartDate(defaultPeriod.startDate);
    setHistoryEndDate(defaultPeriod.endDate);
  };

  const getSelectedCommissionPeriod = () => {
    const defaultPeriod = getDefaultCommissionPeriod();
    return {
      startDate: reportStartDate || defaultPeriod.startDate,
      endDate: reportEndDate || defaultPeriod.endDate,
    };
  };

  const selectedCommissionPeriod = useMemo(
    () => getSelectedCommissionPeriod(),
    [reportEndDate, reportStartDate],
  );

  const commissionPeriodLabel = useMemo(() => {
    const defaultPeriod = getDefaultCommissionPeriod();
    const startDate = reportStartDate || defaultPeriod.startDate;
    const endDate = reportEndDate || defaultPeriod.endDate;

    if (!reportStartDate && !reportEndDate) {
      return `Mostrando o mes atual inteiro (${formatDate(startDate)} ate ${formatDate(endDate)}).`;
    }

    return `Mostrando de ${formatDate(startDate)} ate ${formatDate(endDate)}.`;
  }, [reportEndDate, reportStartDate]);

  const loadCommissionAppointments = async () => {
    if (!profile?.clinic_id) return null;

    const { startDate, endDate } = getSelectedCommissionPeriod();
    const start = parseDateInput(startDate);
    start.setHours(0, 0, 0, 0);
    const endExclusive = addDays(parseDateInput(endDate), 1);
    endExclusive.setHours(0, 0, 0, 0);

    const appointmentsQuery = supabase
      .from("appointments")
      .select(
        `
          id,
          patient_id,
          package_id,
          start_time,
          status,
          class_price,
          commission_amount,
          patients (
            full_name,
            status,
            profiles!patients_responsible_professional_id_fkey (id, full_name)
          ),
          profiles (id, full_name),
          lesson_packages (
            total_lessons,
            lesson_value,
            procedure_amount,
            total_amount
          )
        `,
      )
      .eq("clinic_id", profile.clinic_id)
      .gte("start_time", start.toISOString())
      .lt("start_time", endExclusive.toISOString());

    const appointmentsResult = await appointmentsQuery;

    if (appointmentsResult.error) {
      setError(appointmentsResult.error.message);
      return appointmentsResult;
    }

    const fetchedAppointments =
      (appointmentsResult.data ?? []) as unknown as CommissionAppointment[];

    const appointmentsToSet =
      profile.role === "physio"
        ? fetchedAppointments.filter(
            (appointment) =>
              appointment.patients?.status !== undefined &&
              appointment.patients.status !== "inativo" &&
              getAppointmentResponsibleProfessional(appointment).id === profile.id,
          )
        : fetchedAppointments.filter(
            (appointment) =>
              appointment.patients?.status !== undefined &&
              appointment.patients.status !== "inativo",
          );

    setAppointments(appointmentsToSet);
    return appointmentsResult;
  };

  const downloadWorkbook = async (
    options: Omit<CommissionWorkbookOptions, "clinicName">,
    fileName: string,
  ) => {
    try {
      // exceljs só é baixado quando alguém exporta
      const { buildCommissionWorkbook } = await import("./planilhaComissoes");
      const blob = await buildCommissionWorkbook({
        ...options,
        clinicName: clinicProfile?.name ?? "Clínica",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      console.error("Erro ao gerar planilha:", exportError);
      alert("Não foi possível gerar a planilha. Tente novamente.");
    }
  };

  const workbookFileSuffix = (startDate: string, endDate: string) =>
    startDate.slice(0, 7) === endDate.slice(0, 7)
      ? startDate.slice(0, 7)
      : `${startDate}_a_${endDate}`;

  const downloadCommissionReportExcel = async () => {
    if (!commissionReport.length && !commissionDetailReport.length) {
      alert("Nenhum relatório para exportar");
      return;
    }

    const { startDate, endDate } = getSelectedCommissionPeriod();

    if (daysBetweenInclusive(startDate, endDate) > 31) {
      alert("O relatório detalhado em Excel aceita no máximo 31 dias.");
      return;
    }

    const ownName = isPhysio ? commissionReport[0]?.professionalName : null;
    await downloadWorkbook(
      {
        mode: "commission",
        ownSheetOnly: isPhysio,
        report: commissionReport,
        detailRows: commissionDetailReport,
        startDate,
        endDate,
      },
      ownName
        ? `comissao_${normalizeSearchText(ownName).replace(/[^a-z0-9]+/g, "_")}_${workbookFileSuffix(startDate, endDate)}.xlsx`
        : `comissoes_${workbookFileSuffix(startDate, endDate)}.xlsx`,
    );
  };

  const downloadAdminProductionExcel = async () => {
    if (!adminProductionReport.length && !adminProductionDetailReport.length) {
      alert("Nenhum atendimento da administradora encontrado no período.");
      return;
    }

    const { startDate, endDate } = selectedCommissionPeriod;
    if (daysBetweenInclusive(startDate, endDate) > 31) {
      alert("O relatório detalhado em Excel aceita no máximo 31 dias.");
      return;
    }

    await downloadWorkbook(
      {
        mode: "admin_production",
        report: adminProductionReport,
        detailRows: adminProductionDetailReport,
        startDate,
        endDate,
      },
      `producao_administradora_${workbookFileSuffix(startDate, endDate)}.xlsx`,
    );
  };

  const loadFinancialData = async () => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [clinicResult, packagesResult, appointmentsResult, transactionsResult] = await Promise.all([
      supabase
        .from("clinics")
        .select("owner_id")
        .eq("id", profile.clinic_id)
        .single(),
      supabase
        .from("lesson_packages")
        .select(
          `
            id,
            patient_id,
            total_lessons,
            completed_lessons,
            missed_lessons,
            procedure_amount,
            total_amount,
            amount_paid,
            payment_status,
            payment_method,
            installments,
            start_date,
            created_at,
            expected_end_date,
            status,
            patients (
              full_name,
              phone,
              status,
              profiles!patients_responsible_professional_id_fkey (full_name)
            ),
            package_installments (
              id,
              installment_number,
              amount,
              amount_paid,
              due_date,
              paid_at,
              payment_method,
              status
            )
          `,
        )
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false }),
      loadCommissionAppointments(),
      supabase
        .from("transactions")
        .select(
          `
            id,
            patient_id,
            package_id,
            amount,
            type,
            category,
            status,
            description,
            attachments,
            due_date,
            created_at,
            patients (
              full_name,
              status,
              profiles!patients_responsible_professional_id_fkey (full_name)
            )
          `,
        )
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false }),
    ]);

    let finalTransactionsResult = transactionsResult;
    if (
      transactionsResult?.error?.message.includes(
        "column transactions.attachments does not exist",
      )
    ) {
      setSupportsTransactionAttachments(false);
      const retryResult = await supabase
        .from("transactions")
        .select(
          `
            id,
            patient_id,
            amount,
            type,
            category,
            status,
            description,
            due_date,
            created_at,
            patients (
              full_name,
              status,
              profiles!patients_responsible_professional_id_fkey (full_name)
            )
          `,
        )
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false });
      finalTransactionsResult = retryResult;
    }

    const failed = [
      clinicResult,
      packagesResult,
      appointmentsResult,
      finalTransactionsResult,
    ].find((result) => result?.error);
    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    setOwnerId((clinicResult.data as { owner_id: string | null }).owner_id);
    setPackages((packagesResult.data ?? []) as unknown as PackageRow[]);
    const loadedAppointments =
      (appointmentsResult?.data ?? []) as unknown as CommissionAppointment[];
    setAppointments(
      loadedAppointments.filter((appointment) => {
        if (
          appointment.patients?.status === undefined ||
          appointment.patients.status === "inativo"
        ) {
          return false;
        }

        return (
          profile.role !== "physio" ||
          getAppointmentResponsibleProfessional(appointment).id === profile.id
        );
      }),
    );
    setTransactions(
      (finalTransactionsResult.data ?? []) as unknown as TransactionRow[],
    );

    const commissionPaymentsResult = await fetchCommissionPayments(profile.clinic_id);
    if (commissionPaymentsResult.error) setError(commissionPaymentsResult.error);
    setSupportsCommissionPayments(commissionPaymentsResult.supported);
    setCommissionPayments(commissionPaymentsResult.payments);
    setLoading(false);
  };

  useEffect(() => {
    loadFinancialData();
  }, [profile?.clinic_id]);

  useEffect(() => {
    if (loading) return;
    loadCommissionAppointments();
  }, [profile?.clinic_id, reportStartDate, reportEndDate]);

  const filteredAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.patients?.status !== undefined &&
          appointment.patients.status !== "inativo" &&
          matchesPatientSearch(appointment.patients?.full_name, patientSearchTerm),
      ),
    [appointments, patientSearchTerm],
  );

  const filteredPackages = useMemo(
    () =>
      packages.filter(
        (packageItem) =>
          packageItem.patients?.status !== undefined &&
          packageItem.patients.status !== "inativo" &&
          matchesPatientSearch(packageItem.patients?.full_name, patientSearchTerm),
      ),
    [packages, patientSearchTerm],
  );

  const visibleTransactions = useMemo(
    () =>
      dedupeProcedureTransactions(transactions).filter(
        (transaction) =>
          !transaction.patient_id ||
          (transaction.patients?.status !== undefined &&
            transaction.patients.status !== "inativo"),
      ),
    [transactions],
  );

  const filteredVisibleTransactions = useMemo(
    () =>
      visibleTransactions.filter((transaction) =>
        matchesPatientSearch(transaction.patients?.full_name, patientSearchTerm),
      ),
    [patientSearchTerm, visibleTransactions],
  );

  const filteredHistoryTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (!matchesPatientSearch(transaction.patients?.full_name, patientSearchTerm)) {
          return false;
        }
        if (historyStartDate && transaction.due_date < historyStartDate) {
          return false;
        }

        if (historyEndDate && transaction.due_date > historyEndDate) {
          return false;
        }

        return true;
      }),
    [historyEndDate, historyStartDate, patientSearchTerm, transactions],
  );

  const expenseTransactions = useMemo(
    () =>
      visibleTransactions
        .filter((transaction) => transaction.type === "expense")
        .sort((a, b) => {
          const aStatus = getEffectiveTransactionStatus(a);
          const bStatus = getEffectiveTransactionStatus(b);
          const aOpen = aStatus !== "paid" && aStatus !== "cancelled";
          const bOpen = bStatus !== "paid" && bStatus !== "cancelled";

          if (aOpen !== bOpen) return aOpen ? -1 : 1;
          return aOpen
            ? a.due_date.localeCompare(b.due_date)
            : b.due_date.localeCompare(a.due_date);
        }),
    [visibleTransactions],
  );

  const expenseReminders = useMemo(
    () =>
      expenseTransactions
        .filter((transaction) => {
          const effectiveStatus = getEffectiveTransactionStatus(transaction);
          const daysUntil = getDaysUntil(transaction.due_date);

          return (
            effectiveStatus !== "paid" &&
            effectiveStatus !== "cancelled" &&
            daysUntil <= expenseReminderDays
          );
        })
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [expenseTransactions],
  );

  const filteredExpenseTransactions = useMemo(
    () =>
      expenseTransactions.filter((transaction) => {
        if (expenseViewFilter === "payable") {
          const effectiveStatus = getEffectiveTransactionStatus(transaction);
          const daysUntil = getDaysUntil(transaction.due_date);

          return (
            effectiveStatus !== "paid" &&
            effectiveStatus !== "cancelled" &&
            daysUntil <= expensePayableWindowDays
          );
        }

        if (expenseStartDate && transaction.due_date < expenseStartDate) {
          return false;
        }

        if (expenseEndDate && transaction.due_date > expenseEndDate) {
          return false;
        }

        if (expenseViewFilter === "paid") return transaction.status === "paid";

        return true;
      }),
    [expenseEndDate, expenseStartDate, expenseTransactions, expenseViewFilter],
  );

  const expensePeriodTotals = useMemo(() => {
    const paidExpenses = filteredExpenseTransactions
      .filter((transaction) => transaction.status === "paid")
      .reduce((total, item) => total + money(item.amount), 0);
    const openExpenses = filteredExpenseTransactions
      .filter((transaction) => {
        const effectiveStatus = getEffectiveTransactionStatus(transaction);

        return effectiveStatus === "pending" || effectiveStatus === "overdue";
      })
      .reduce((total, item) => total + money(item.amount), 0);

    return { paidExpenses, openExpenses };
  }, [filteredExpenseTransactions]);

  const rawCommissionReport = useMemo(
    () =>
      buildCommissionReport(
        filteredAppointments,
        ownerId,
        selectedCommissionPeriod.startDate,
        selectedCommissionPeriod.endDate,
      ),
    [filteredAppointments, ownerId, selectedCommissionPeriod],
  );

  const commissionReport = useMemo(
    () =>
      rawCommissionReport.map((item) => {
        const commissionPaid = hasPatientSearch
          ? 0
          : supportsCommissionPayments
            ? // Conta o pagamento no período a que ele se refere, não na data em que foi pago.
              commissionPayments
                .filter(
                  (payment) =>
                    payment.professional_id === item.professionalId &&
                    payment.period_start >= selectedCommissionPeriod.startDate &&
                    payment.period_end <= selectedCommissionPeriod.endDate,
                )
                .reduce((total, payment) => total + money(payment.amount), 0)
          : transactions
              .filter(
                (transaction) =>
                  transaction.type === "expense" &&
                  transaction.status === "paid" &&
                  transaction.category === "Comissão fisioterapeuta" &&
                  transaction.due_date >= selectedCommissionPeriod.startDate &&
                  transaction.due_date <= selectedCommissionPeriod.endDate &&
                  (transaction.description?.includes(item.professionalId) ||
                    transaction.description?.includes(item.professionalName)),
              )
              .reduce(
                (total, transaction) => total + money(transaction.amount),
                0,
              );

        return {
          ...item,
          commissionPaid,
          professionalShare: Math.max(
            item.professionalShare - commissionPaid,
            0,
          ),
        };
      }),
    [
      commissionPayments,
      hasPatientSearch,
      rawCommissionReport,
      selectedCommissionPeriod,
      supportsCommissionPayments,
      transactions,
    ],
  );

  const commissionDetailReport = useMemo(() => {
    return buildCommissionDetailReport(
      filteredAppointments,
      ownerId,
      selectedCommissionPeriod.startDate,
      selectedCommissionPeriod.endDate,
    );
  }, [filteredAppointments, ownerId, selectedCommissionPeriod]);

  const adminProductionAppointments = useMemo(
    () =>
      isAdmin && profile
        ? filteredAppointments.filter(
            (appointment) =>
              getAppointmentResponsibleProfessional(appointment).id ===
              profile.id,
          )
        : [],
    [filteredAppointments, isAdmin, profile],
  );

  const adminProductionReport = useMemo(
    () =>
      buildCommissionReport(
        adminProductionAppointments,
        null,
        selectedCommissionPeriod.startDate,
        selectedCommissionPeriod.endDate,
      ).map((item) => ({
        ...item,
        commissionPaid: 0,
        professionalShare: 0,
      })),
    [adminProductionAppointments, selectedCommissionPeriod],
  );

  const adminProductionDetailReport = useMemo(
    () =>
      buildCommissionDetailReport(
        adminProductionAppointments,
        null,
        selectedCommissionPeriod.startDate,
        selectedCommissionPeriod.endDate,
      ).map((item) => ({
        ...item,
        commissionClassValue: 0,
        totalCommission: 0,
      })),
    [adminProductionAppointments, selectedCommissionPeriod],
  );

  const totals = useMemo(() => {
    const monthlyPeriod = getDefaultCommissionPeriod();
    const isInCurrentMonth = (date: string) =>
      date >= monthlyPeriod.startDate && date <= monthlyPeriod.endDate;
    const standaloneProcedures = filteredVisibleTransactions.filter(
      (transaction) => isStandaloneProcedureIncome(transaction) && isInCurrentMonth(transaction.due_date),
    );
    const procedureSold = standaloneProcedures.reduce(
      (total, item) => total + money(item.amount),
      0,
    );
    const procedureOpen = standaloneProcedures
      .filter((item) => item.status === "pending" || item.status === "overdue")
      .reduce((total, item) => total + money(item.amount), 0);
    const packagesSoldThisMonth = filteredPackages.filter((item) =>
      isInCurrentMonth(item.created_at.slice(0, 10)),
    );
    const sold = packagesSoldThisMonth.reduce(
      (total, item) => total + money(item.total_amount),
      procedureSold,
    );
    const paid = filteredVisibleTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          transaction.status === "paid" &&
          isInCurrentMonth(transaction.due_date),
      )
      .reduce((total, item) => total + money(item.amount), 0);
    const openPackageInstallments = filteredPackages.reduce(
      (total, packageItem) =>
        total + getInstallments(packageItem)
          .filter((installment) => isInCurrentMonth(installment.due_date))
          .reduce((installmentTotal, installment) => installmentTotal + getRemainingInstallment(installment), 0),
      0,
    );
    const open = openPackageInstallments + procedureOpen;
    const professionalShare = commissionReport.reduce(
      (total, item) => total + item.professionalShare,
      0,
    );
    const paidExpenses = transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.status === "paid" &&
          isInCurrentMonth(transaction.due_date),
      )
      .reduce((total, item) => total + money(item.amount), 0);
    const net = paid - paidExpenses;

    return {
      sold,
      paid,
      open,
      professionalShare,
      paidExpenses,
      net,
    };
  }, [
    commissionReport,
    filteredPackages,
    filteredVisibleTransactions,
    transactions,
  ]);

  const receivables = useMemo(() => {
    const packageRows: ReceivableItem[] = filteredPackages.flatMap((packageItem) =>
      getInstallments(packageItem).map((installment) => ({
        kind: "package" as const,
        packageItem,
        installment,
        patientName: packageItem.patients?.full_name ?? "Paciente",
        professionalName: getPatientProfessionalName(packageItem.patients),
        remaining: getRemainingInstallment(installment),
        status: getInstallmentPaymentStatus(installment),
        cardMachine: isCardMachineReceivable(installment.payment_method),
      })),
    );
    const procedureRows: ReceivableItem[] = filteredVisibleTransactions
      .filter(isStandaloneProcedureIncome)
      .map((transaction) => ({
        kind: "procedure" as const,
        transaction,
        patientName: transaction.patients?.full_name ?? "Paciente",
        professionalName: getPatientProfessionalName(transaction.patients),
        remaining:
          transaction.status === "paid" || transaction.status === "cancelled"
            ? 0
            : money(transaction.amount),
        status: paymentStatusFromTransaction(transaction.status),
        cardMachine: isCardMachineReceivable(transaction.description),
      }));
    // A entrada não corresponde a uma parcela: ela é um recebimento já pago
    // na contratação/renovação e precisa aparecer nos filtros Pagas e Todas.
    const initialReceiptRows: ReceivableItem[] = filteredVisibleTransactions
      .filter(isInitialPackageReceipt)
      .map((transaction) => ({
        kind: "package_receipt" as const,
        transaction,
        patientName: transaction.patients?.full_name ?? "Paciente",
        professionalName: getPatientProfessionalName(transaction.patients),
        remaining: 0,
        status: paymentStatusFromTransaction(transaction.status),
        cardMachine: false,
      }));
    const rows = [...packageRows, ...procedureRows, ...initialReceiptRows];

    return rows
      .filter((row) => {
        if (receivableFilter === "paid") return row.status === "pago";
        if (receivableFilter === "open") return row.remaining > 0;
        if (receivableFilter === "card") return row.cardMachine && row.remaining > 0;
        return true;
      })
      .sort((a, b) => {
        const direction = dueSort === "asc" ? 1 : -1;
        const aDate =
          a.kind === "package"
            ? a.installment.due_date
            : a.transaction.due_date;
        const bDate =
          b.kind === "package"
            ? b.installment.due_date
            : b.transaction.due_date;
        return aDate.localeCompare(bDate) * direction;
      });
  }, [dueSort, filteredPackages, filteredVisibleTransactions, receivableFilter]);

  // Pacotes antigos com forma "cartão de crédito" que ficaram com parcelas em
  // aberto (antes não havia como dizer que a maquininha já pagou tudo).
  const legacyCardPackages = useMemo<LegacyCardPackage[]>(
    () =>
      filteredPackages.flatMap((packageItem) => {
        if (!looksLikeCreditCard(packageItem.payment_method)) return [];
        const open = getInstallments(packageItem).filter(
          (installment) =>
            getRemainingInstallment(installment) > 0 &&
            !isCardMachineReceivable(installment.payment_method),
        );
        if (open.length === 0) return [];
        return [
          {
            packageItem,
            firstOpenInstallment: open[0],
            openAmount: open.reduce((total, item) => total + getRemainingInstallment(item), 0),
            openCount: open.length,
          },
        ];
      }),
    [filteredPackages],
  );

  // Parcelas da maquininha que já venceram e ninguém confirmou.
  const overdueCardReceivables = useMemo(() => {
    const today = todayDate();
    const installments = filteredPackages.flatMap((packageItem) =>
      getInstallments(packageItem).filter(
        (installment) =>
          isCardMachineReceivable(installment.payment_method) &&
          getRemainingInstallment(installment) > 0 &&
          installment.due_date <= today,
      ).map((installment) => getRemainingInstallment(installment)),
    );
    const procedures = filteredVisibleTransactions
      .filter(
        (transaction) =>
          isCardMachineReceivable(transaction.description) &&
          transaction.status !== "paid" &&
          transaction.status !== "cancelled" &&
          transaction.due_date <= today,
      )
      .map((transaction) => money(transaction.amount));
    const amounts = [...installments, ...procedures];
    return { count: amounts.length, amount: amounts.reduce((total, value) => total + value, 0) };
  }, [filteredPackages, filteredVisibleTransactions]);

  const openPaymentModal = (
    packageItem: PackageRow,
    installment: InstallmentRow,
    options: { amount?: number; date?: string; notes?: string } = {},
  ) => {
    const cardConfirmation = isCardMachineReceivable(installment.payment_method);
    setPaymentTarget({ kind: "package", packageItem, installment, cardConfirmation });
    // Duas casas: "300.00" (o campo lê só dígitos; "300" viraria R$ 3,00).
    const amount = options.amount ?? getRemainingInstallment(installment);
    setPaymentAmount(amount > 0 ? amount.toFixed(2) : "");
    setPaymentMethod(
      paymentMethodForSelect(installment.payment_method ?? packageItem.payment_method),
    );
    setPaymentReceivedDate(options.date ?? todayDate());
    setPaymentNotes(options.notes ?? "");
  };

  // Pacote antigo pago no cartão: quita todas as parcelas de uma vez
  // (a janela de pagamento distribui o valor entre as parcelas em aberto).
  const openLegacyCardSettlement = (legacy: LegacyCardPackage) => {
    openPaymentModal(legacy.packageItem, legacy.firstOpenInstallment, {
      amount: Math.max(
        money(legacy.packageItem.total_amount) - money(legacy.packageItem.amount_paid),
        0,
      ),
      date: (legacy.packageItem.start_date || legacy.packageItem.created_at || todayDate()).slice(0, 10),
      notes: "Pago no cartão na contratação",
    });
    setPaymentMethod(CREDIT_CARD_METHOD);
  };

  const openProcedurePaymentModal = (transaction: TransactionRow) => {
    const cardConfirmation = isCardMachineReceivable(transaction.description);
    setPaymentTarget({ kind: "procedure", transaction, cardConfirmation });
    setPaymentAmount(money(transaction.amount) > 0 ? money(transaction.amount).toFixed(2) : "");
    setPaymentMethod(cardConfirmation ? CREDIT_CARD_METHOD : "Pix");
    setPaymentReceivedDate(todayDate());
    setPaymentNotes("");
  };

  const handleRegisterPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentTarget) return;

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setError("Informe um valor de pagamento válido.");
      return;
    }

    setSaving(true);
    setError(null);

    if (paymentTarget.kind === "procedure") {
      const openAmount = money(paymentTarget.transaction.amount);

      if (amount > openAmount) {
        setError(
          `O valor informado é maior que o saldo do procedimento (${currencyFormatter.format(openAmount)}).`,
        );
        setSaving(false);
        return;
      }

      const paymentDate = paymentReceivedDate;
      const receiptNotes = paymentNotes.trim();
      const remainingAmount = Math.max(openAmount - amount, 0);
      const baseDescription =
        paymentTarget.transaction.description ?? "Recebimento de procedimentos";
      const paidDescription = cleanProcedurePaymentDescription(baseDescription);

      if (remainingAmount <= 0) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            status: "paid",
            due_date: paymentDate,
            description: `${paidDescription} (${paymentMethod})${receiptNotes ? ` - ${receiptNotes}` : ""}`,
          })
          .eq("id", paymentTarget.transaction.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }
      } else {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            amount: remainingAmount,
            status: "pending",
            description: `${baseDescription} - saldo restante`,
          })
          .eq("id", paymentTarget.transaction.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }

        const { error: insertError } = await supabase
          .from("transactions")
          .insert({
            clinic_id: profile?.clinic_id,
            patient_id: paymentTarget.transaction.patient_id,
            amount,
            type: "income",
            category: "Recebimento de procedimentos",
            status: "paid",
            description: `${paidDescription} - recebido (${paymentMethod})${receiptNotes ? ` - ${receiptNotes}` : ""}`,
            due_date: paymentDate,
          });

        if (insertError) {
          setError(insertError.message);
          setSaving(false);
          return;
        }
      }

      setPaymentTarget(null);
      setSaving(false);
      await loadFinancialData();
      return;
    }

    const packageOpen = Math.max(
      money(paymentTarget.packageItem.total_amount) -
        money(paymentTarget.packageItem.amount_paid),
      0,
    );

    if (amount > packageOpen) {
      setError(
        `O valor informado é maior que o saldo do pacote (${currencyFormatter.format(packageOpen)}).`,
      );
      setSaving(false);
      return;
    }

    const installments = getInstallments(paymentTarget.packageItem);
    const selectedIndex = installments.findIndex(
      (item) => item.id === paymentTarget.installment.id,
    );
    const orderedInstallments = [
      ...installments.slice(Math.max(selectedIndex, 0)),
      ...installments.slice(0, Math.max(selectedIndex, 0)),
    ].filter((item) => getRemainingInstallment(item) > 0);

    let remainingAmount = amount;
    const paymentDate = `${paymentReceivedDate}T12:00:00`;
    const receiptNotes = paymentNotes.trim();
    const updates: Promise<{ error: Error | null }>[] = [];

    for (const installment of orderedInstallments) {
      if (remainingAmount <= 0) break;

      const installmentTotal = money(installment.amount);
      const currentPaid = money(installment.amount_paid);
      const appliedAmount = Math.min(
        remainingAmount,
        Math.max(installmentTotal - currentPaid, 0),
      );

      if (appliedAmount <= 0) continue;

      const installmentPaid = currentPaid + appliedAmount;
      const installmentStatus = statusFromPayment(
        installmentTotal,
        installmentPaid,
      );
      remainingAmount -= appliedAmount;

      updates.push(
        supabase
          .from("package_installments")
          .update({
            amount_paid: installmentPaid,
            payment_method:
              isCardMachineReceivable(installment.payment_method) &&
              paymentMethod === CREDIT_CARD_METHOD
                ? CARD_MACHINE_METHOD
                : paymentMethod,
            status: installmentStatus,
            paid_at: installmentStatus === "pago" ? paymentDate : null,
          })
          .eq("id", installment.id) as unknown as Promise<{
          error: Error | null;
        }>,
      );
    }

    const installmentResults = await Promise.all(updates);
    const installmentError = installmentResults.find(
      (result) => result.error,
    )?.error;

    if (installmentError) {
      setError(installmentError.message);
      setSaving(false);
      return;
    }

    const newPackagePaid =
      money(paymentTarget.packageItem.amount_paid) + amount;
    const packageStatus = statusFromPayment(
      money(paymentTarget.packageItem.total_amount),
      newPackagePaid,
    );

    const { error: packageError } = await supabase
      .from("lesson_packages")
      .update({
        amount_paid: newPackagePaid,
        payment_method: paymentMethod,
        payment_status: packageStatus,
      })
      .eq("id", paymentTarget.packageItem.id);

    if (packageError) {
      setError(packageError.message);
      setSaving(false);
      return;
    }

    const { error: transactionError } = await supabase
      .from("transactions")
          .insert({
            clinic_id: profile?.clinic_id,
            patient_id: paymentTarget.packageItem.patient_id,
            package_id: paymentTarget.packageItem.id,
            amount,
            type: "income",
            category: "Recebimento de pacote",
            status: "paid",
            description: `Recebimento de ${paymentTarget.packageItem.patients?.full_name ?? "paciente"} - pacote · parcela #${paymentTarget.installment.installment_number} (${paymentMethod})${receiptNotes ? ` - ${receiptNotes}` : ""}`,
            due_date: paymentReceivedDate,
          });

    if (transactionError) {
      setError(transactionError.message);
      setSaving(false);
      return;
    }

    setPaymentTarget(null);
    setSaving(false);
    await loadFinancialData();
  };

  const openCommissionPayment = (item: ProfessionalReport) => {
    setError(null);
    setCommissionTarget(item);
    setCommissionPaymentAmount(item.professionalShare.toFixed(2));
    setCommissionPaidAt(todayDate());
  };

  const handleRegisterCommissionPayment = async () => {
    if (!commissionTarget || !profile?.clinic_id) return;

    if (supportsCommissionPayments) {
      const amount = Number(commissionPaymentAmount.replace(",", "."));
      if (!amount || amount <= 0) {
        setError("Informe um valor de comissão válido.");
        return;
      }
      if (amount > commissionTarget.professionalShare + 0.005) {
        setError(
          `O valor é maior que o saldo a pagar no período (${currencyFormatter.format(commissionTarget.professionalShare)}).`,
        );
        return;
      }
      if (!commissionPaidAt) {
        setError("Informe a data do pagamento.");
        return;
      }

      setSaving(true);
      setError(null);

      const { error: paymentError } = await supabase.rpc(
        "register_commission_payment",
        {
          p_professional_id: commissionTarget.professionalId,
          p_period_start: selectedCommissionPeriod.startDate,
          p_period_end: selectedCommissionPeriod.endDate,
          p_amount: amount,
          p_paid_at: commissionPaidAt,
        },
      );

      if (paymentError) {
        setError(paymentError.message);
        setSaving(false);
        return;
      }

      setCommissionTarget(null);
      setSaving(false);
      await loadFinancialData();
      return;
    }

    setSaving(true);
    setError(null);

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        clinic_id: profile.clinic_id,
        amount: commissionTarget.professionalShare,
        type: "expense",
        category: "Comissão fisioterapeuta",
        status: "paid",
        description: `Pagamento de comissão para ${commissionTarget.professionalName} (${commissionTarget.professionalId})`,
        due_date: todayDate(),
      });

    if (transactionError) {
      setError(transactionError.message);
      setSaving(false);
      return;
    }

    setCommissionTarget(null);
    setSaving(false);
    await loadFinancialData();
  };

  // Revisão dos pagamentos migrados: define profissional e mês de referência.
  const handleConfirmCommissionPayment = async (
    payment: CommissionPayment,
    referenceMonth: string,
    professionalId: string,
  ) => {
    const period = monthRange(`${referenceMonth}-01`);
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("commission_payments")
      .update({
        professional_id: professionalId,
        period_start: period.startDate,
        period_end: period.endDate,
        needs_review: false,
      })
      .eq("id", payment.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCommissionPayments((current) =>
      current.map((item) =>
        item.id === payment.id
          ? {
              ...item,
              professional_id: professionalId,
              period_start: period.startDate,
              period_end: period.endDate,
              needs_review: false,
            }
          : item,
      ),
    );
  };

  const handleRegisterExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.clinic_id) return;

    const amount = Number(expenseForm.amount);
    if (!amount || amount <= 0) {
      setError("Informe um valor de despesa válido.");
      return;
    }

    setSaving(true);
    setError(null);

    let attachments: string[] | null = null;
    if (expenseForm.document && supportsTransactionAttachments) {
      try {
        const documentUrl = await uploadTransactionDocument(
          profile.clinic_id,
          expenseForm.document,
        );
        attachments = [documentUrl];
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
        setSaving(false);
        return;
      }
    }

    const dataToInsert: Record<string, unknown> = {
      clinic_id: profile.clinic_id,
      amount,
      type: "expense",
      category: expenseForm.category,
      status: expenseForm.status,
      description: expenseForm.description.trim() || null,
      due_date: expenseForm.dueDate || todayDate(),
    };

    if (supportsTransactionAttachments && attachments) {
      dataToInsert.attachments = attachments;
    }

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert(dataToInsert);

    if (transactionError) {
      setError(transactionError.message);
      setSaving(false);
      return;
    }

    // Mostra a despesa onde ela foi parar: paga → "Pagas"; senão → "A pagar".
    setExpenseViewFilter(expenseForm.status === "paid" ? "paid" : "payable");
    setExpenseForm(initialExpenseForm());
    setExpenseFormOpen(false);
    setSaving(false);
    await loadFinancialData();
  };

  const handleOpenAttachmentUploader = (transaction: TransactionRow) => {
    if (!supportsTransactionAttachments) return;
    setAttachmentTarget(transaction);
    attachmentInputRef.current?.click();
  };

  const handleAttachExpenseDocument = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.clinic_id || !attachmentTarget) return;

    setSaving(true);
    setError(null);

    try {
      const documentUrl = await uploadTransactionDocument(
        profile.clinic_id,
        file,
      );
      const updatedAttachments = [
        ...(attachmentTarget.attachments ?? []),
        documentUrl,
      ];

      const { error: updateError } = await supabase
        .from("transactions")
        .update({ attachments: updatedAttachments })
        .eq("id", attachmentTarget.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setAttachmentTarget(null);
      event.target.value = "";
      await loadFinancialData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkExpensePaid = async (transaction: TransactionRow) => {
    if (transaction.type !== "expense") return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "paid",
        due_date: todayDate(),
      })
      .eq("id", transaction.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadFinancialData();
  };

  const handleDeleteExpense = async (transaction: TransactionRow) => {
    if (transaction.type !== "expense" || !profile?.clinic_id) return;

    const confirmed = window.confirm(
      `Excluir a despesa "${transaction.category}" no valor de ${currencyFormatter.format(money(transaction.amount))}?`,
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("clinic_id", profile.clinic_id)
      .eq("type", "expense");

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadFinancialData();
  };

  const handleDeleteTransaction = async (transaction: TransactionRow) => {
    if (!isAdmin || !profile?.clinic_id) return;

    const confirmed = window.confirm(
      `Excluir o lançamento "${transaction.category}" no valor de ${currencyFormatter.format(money(transaction.amount))}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    // A payment for a package is stored in the history as a transaction and in
    // Receivables as an installment. Remove the paired installment as well.
    if (
      transaction.category === "Recebimento de pacote" &&
      transaction.patient_id &&
      transaction.package_id
    ) {
      const installmentNumber = Number(
        transaction.description?.match(/parcela\s*#(\d+)/i)?.[1],
      );
      let installmentsQuery = supabase
        .from("package_installments")
        .select("id, package_id, installment_number, amount, amount_paid")
        .eq("clinic_id", profile.clinic_id)
        .eq("patient_id", transaction.patient_id)
        .eq("package_id", transaction.package_id)
        .eq("status", "pago");

      if (installmentNumber) {
        installmentsQuery = installmentsQuery.eq(
          "installment_number",
          installmentNumber,
        );
      }

      const { data: candidates, error: installmentsError } =
        await installmentsQuery;
      if (installmentsError) {
        setError(installmentsError.message);
        setSaving(false);
        return;
      }

      const matchingInstallments = (candidates ?? []).filter(
        (installment) =>
          installmentNumber ||
          Math.abs(money(installment.amount_paid) - money(transaction.amount)) <
            0.005,
      );

      // For older records that did not store the installment number, only use
      // an automatic match when it is unambiguous.
      if (matchingInstallments.length === 1) {
        const installment = matchingInstallments[0];
        const { data: packageItem, error: packageReadError } = await supabase
          .from("lesson_packages")
          .select("total_amount, amount_paid")
          .eq("id", installment.package_id)
          .eq("clinic_id", profile.clinic_id)
          .single();

        if (packageReadError) {
          setError(packageReadError.message);
          setSaving(false);
          return;
        }

        const remainingTotal = Math.max(
          money(packageItem.total_amount) - money(installment.amount),
          0,
        );
        const remainingPaid = Math.max(
          money(packageItem.amount_paid) - money(installment.amount_paid),
          0,
        );
        const { error: packageUpdateError } = await supabase
          .from("lesson_packages")
          .update({
            total_amount: remainingTotal,
            amount_paid: remainingPaid,
            payment_status: statusFromPayment(remainingTotal, remainingPaid),
          })
          .eq("id", installment.package_id)
          .eq("clinic_id", profile.clinic_id);
        if (packageUpdateError) {
          setError(packageUpdateError.message);
          setSaving(false);
          return;
        }

        const { error: installmentDeleteError } = await supabase
          .from("package_installments")
          .delete()
          .eq("id", installment.id)
          .eq("clinic_id", profile.clinic_id);
        if (installmentDeleteError) {
          setError(installmentDeleteError.message);
          setSaving(false);
          return;
        }
      }
    }

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("clinic_id", profile.clinic_id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadFinancialData();
  };

  const handleDeletePackageInstallment = async (
    packageItem: PackageRow,
    installment: InstallmentRow,
  ) => {
    if (!isAdmin || !profile?.clinic_id) return;

    const confirmed = window.confirm(
      `Excluir a parcela #${installment.installment_number} de ${currencyFormatter.format(money(installment.amount))}? Ela será removida dos Recebíveis e esta ação não poderá ser desfeita.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const nextTotal = Math.max(
      money(packageItem.total_amount) - money(installment.amount),
      0,
    );
    const nextPaid = Math.max(
      money(packageItem.amount_paid) - money(installment.amount_paid),
      0,
    );
    const { error: packageUpdateError } = await supabase
      .from("lesson_packages")
      .update({
        total_amount: nextTotal,
        amount_paid: nextPaid,
        payment_status: statusFromPayment(nextTotal, nextPaid),
      })
      .eq("id", packageItem.id)
      .eq("clinic_id", profile.clinic_id);

    if (packageUpdateError) {
      setError(packageUpdateError.message);
      setSaving(false);
      return;
    }

    const { error: installmentDeleteError } = await supabase
      .from("package_installments")
      .delete()
      .eq("id", installment.id)
      .eq("clinic_id", profile.clinic_id);

    if (installmentDeleteError) {
      setError(installmentDeleteError.message);
      setSaving(false);
      return;
    }

    // New receipts carry the installment number, so their history entry can be
    // removed without risking another payment from the same patient.
    const { error: receiptDeleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("clinic_id", profile.clinic_id)
      .eq("patient_id", packageItem.patient_id)
      .eq("category", "Recebimento de pacote")
      .ilike("description", `%parcela #${installment.installment_number}%`);

    if (receiptDeleteError) {
      setError(receiptDeleteError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadFinancialData();
  };

  const generateFinancialPdf = () => {
    const { payable, paid, receipts } = financialReportSections;
    if (!payable && !paid && !receipts) {
      setError("Selecione ao menos uma seção para o relatório.");
      return;
    }
    if (!financialReportStartDate || !financialReportEndDate || financialReportStartDate > financialReportEndDate) {
      setError("Informe um período válido para o relatório.");
      return;
    }

    const inPeriod = (item: TransactionRow) => item.due_date >= financialReportStartDate && item.due_date <= financialReportEndDate;
    const reportTransactions = visibleTransactions.filter(inPeriod);
    const payableExpenses = reportTransactions.filter((item) => item.type === "expense" && !["paid", "cancelled"].includes(getEffectiveTransactionStatus(item))).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const paidExpenses = reportTransactions.filter((item) => item.type === "expense" && item.status === "paid").sort((a, b) => a.due_date.localeCompare(b.due_date));
    const paidReceipts = reportTransactions.filter((item) => item.type === "income" && item.status === "paid").sort((a, b) => a.due_date.localeCompare(b.due_date));
    const payableTotal = payableExpenses.reduce((total, item) => total + money(item.amount), 0);
    const paidTotal = paidExpenses.reduce((total, item) => total + money(item.amount), 0);
    const receiptTotal = paidReceipts.reduce((total, item) => total + money(item.amount), 0);
    const table = (rows: TransactionRow[], emptyText: string, type: "expense" | "income") => rows.length
      ? `<table><thead><tr><th>Data</th><th>${type === "income" ? "Paciente / origem" : "Categoria"}</th><th>Descrição</th><th>Status</th><th class="amount">Valor</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${formatDate(item.due_date)}</td><td>${escapeHtml(type === "income" ? item.patients?.full_name ?? item.category : item.category)}</td><td>${escapeHtml(item.description) || "-"}</td><td>${escapeHtml(transactionStatusLabel[getEffectiveTransactionStatus(item)])}</td><td class="amount">${currencyFormatter.format(money(item.amount))}</td></tr>`).join("")}</tbody></table>`
      : `<p class="empty">${emptyText}</p>`;
    const section = (title: string, total: number, content: string) => `<section><div class="section-title"><h2>${title}</h2><strong>${currencyFormatter.format(total)}</strong></div>${content}</section>`;
    const sections = [
      payable && section("Contas a pagar", payableTotal, table(payableExpenses, "Nenhuma conta a pagar no período selecionado.", "expense")),
      paid && section("Contas pagas", paidTotal, table(paidExpenses, "Nenhuma conta paga no período selecionado.", "expense")),
      receipts && section("Recebimentos", receiptTotal, table(paidReceipts, "Nenhum recebimento no período selecionado.", "income")),
    ].filter(Boolean).join("");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("Não foi possível abrir o relatório. Autorize pop-ups para este site e tente novamente.");
      return;
    }
    const net = receiptTotal - paidTotal;
    reportWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Relatório financeiro</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;font-size:11px}h1{font-size:22px;margin:0 0 5px}.muted{color:#64748b;margin:0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0}.summary div{border:1px solid #e2e8f0;border-radius:7px;padding:10px}.summary span{display:block;color:#64748b;font-size:10px;margin-bottom:5px}.summary strong{font-size:14px}section{margin-top:24px;break-inside:avoid}.section-title{border-bottom:2px solid #0f766e;display:flex;align-items:baseline;justify-content:space-between;padding-bottom:6px;margin-bottom:10px}h2{font-size:15px;margin:0}table{border-collapse:collapse;width:100%}th{background:#f1f5f9;color:#475569;font-size:9px;letter-spacing:.04em;text-align:left;text-transform:uppercase}th,td{border-bottom:1px solid #e2e8f0;padding:7px 6px;vertical-align:top}.amount{text-align:right;white-space:nowrap}.empty{border:1px dashed #cbd5e1;border-radius:6px;color:#64748b;padding:12px}footer{border-top:1px solid #e2e8f0;color:#64748b;font-size:9px;margin-top:28px;padding-top:9px}${CLINIC_HEADER_CSS}.clinic-header{margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0}</style></head><body>${clinicHeaderHtml(clinicProfile)}<header><h1>Relatório financeiro</h1><p class="muted">Período: ${formatDate(financialReportStartDate)} a ${formatDate(financialReportEndDate)}</p><p class="muted">Emitido em ${new Date().toLocaleDateString("pt-BR")}</p></header><div class="summary"><div><span>A pagar</span><strong>${currencyFormatter.format(payableTotal)}</strong></div><div><span>Pago</span><strong>${currencyFormatter.format(paidTotal)}</strong></div><div><span>Recebido</span><strong>${currencyFormatter.format(receiptTotal)}</strong></div><div><span>Resultado líquido</span><strong>${currencyFormatter.format(net)}</strong></div></div>${sections}<footer>Relatório gerado pelo sistema financeiro da clínica.</footer><script>window.onload=()=>window.print();<\/script></body></html>`);
    reportWindow.document.close();
    setFinancialReportOpen(false);
  };

  const printReceipt = (
    packageItem: PackageRow,
    installment?: InstallmentRow,
  ) => {
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) return;
    receiptWindow.opener = null;

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Recibo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            ${CLINIC_HEADER_CSS}
            .clinic-header { max-width: 620px; margin-bottom: 20px; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; max-width: 620px; }
            h1 { margin: 0 0 8px; }
            p { margin: 8px 0; }
            .value { font-size: 24px; font-weight: 700; margin: 16px 0; }
          </style>
        </head>
        <body>
          ${clinicHeaderHtml(clinicProfile)}
          <div class="box">
            <h1>Recibo de pagamento</h1>
            <p>Paciente: <strong>${escapeHtml(packageItem.patients?.full_name) || "-"}</strong></p>
            <p>Pacote: ${packageItem.total_lessons} aulas${money(packageItem.procedure_amount) > 0 ? ` + ${currencyFormatter.format(money(packageItem.procedure_amount))} em procedimentos` : ""}</p>
            <p>Parcela: ${installment?.installment_number ?? "-"}</p>
            <p>Forma de pagamento: ${installment?.payment_method ?? packageItem.payment_method ?? "-"}</p>
            <p class="value">${currencyFormatter.format(money(installment?.amount_paid ?? packageItem.amount_paid))}</p>
            <p>Emitido em ${new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <script>window.onload = () => window.print();<\/script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
  };

  const printTransactionReceipt = (transaction: TransactionRow) => {
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) return;
    receiptWindow.opener = null;

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Recibo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            ${CLINIC_HEADER_CSS}
            .clinic-header { max-width: 620px; margin-bottom: 20px; }
            .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; max-width: 620px; }
            h1 { margin: 0 0 8px; }
            p { margin: 8px 0; }
            .value { font-size: 24px; font-weight: 700; margin: 16px 0; }
          </style>
        </head>
        <body>
          ${clinicHeaderHtml(clinicProfile)}
          <div class="box">
            <h1>Recibo de pagamento</h1>
            <p>Paciente: <strong>${escapeHtml(transaction.patients?.full_name) || "-"}</strong></p>
            <p>Referência: ${escapeHtml(transaction.description ?? transaction.category)}</p>
            <p>Data: ${formatDate(transaction.due_date)}</p>
            <p class="value">${currencyFormatter.format(money(transaction.amount))}</p>
            <p>Emitido em ${new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <script>window.onload = () => window.print();<\/script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
  };


  return {
    expenseFormOpen,
    setExpenseFormOpen,
    legacyCardPackages,
    overdueCardReceivables,
    openLegacyCardSettlement,
    commissionPayments,
    supportsCommissionPayments,
    commissionPaymentAmount,
    setCommissionPaymentAmount,
    commissionPaidAt,
    setCommissionPaidAt,
    openCommissionPayment,
    handleConfirmCommissionPayment,
    profile,
    clinicProfile,
    setClinicProfile,
    packages,
    setPackages,
    appointments,
    setAppointments,
    transactions,
    setTransactions,
    ownerId,
    setOwnerId,
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
    receivableFilter,
    setReceivableFilter,
    dueSort,
    setDueSort,
    expenseViewFilter,
    setExpenseViewFilter,
    patientSearchTerm,
    setPatientSearchTerm,
    loading,
    setLoading,
    saving,
    setSaving,
    supportsTransactionAttachments,
    setSupportsTransactionAttachments,
    attachmentTarget,
    setAttachmentTarget,
    attachmentInputRef,
    error,
    setError,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    expenseStartDate,
    setExpenseStartDate,
    expenseEndDate,
    setExpenseEndDate,
    historyStartDate,
    setHistoryStartDate,
    historyEndDate,
    setHistoryEndDate,
    financialReportOpen,
    setFinancialReportOpen,
    financialReportStartDate,
    setFinancialReportStartDate,
    financialReportEndDate,
    setFinancialReportEndDate,
    financialReportSections,
    setFinancialReportSections,
    expenseForm,
    setExpenseForm,
    expenseSectionRef,
    isPhysio,
    isAdmin,
    hasPatientSearch,
    scrollToExpense,
    resetExpensePeriod,
    resetHistoryPeriod,
    getSelectedCommissionPeriod,
    selectedCommissionPeriod,
    commissionPeriodLabel,
    loadCommissionAppointments,
    downloadCommissionReportExcel,
    downloadAdminProductionExcel,
    loadFinancialData,
    filteredAppointments,
    filteredPackages,
    visibleTransactions,
    filteredVisibleTransactions,
    filteredHistoryTransactions,
    expenseTransactions,
    expenseReminders,
    filteredExpenseTransactions,
    expensePeriodTotals,
    rawCommissionReport,
    commissionReport,
    commissionDetailReport,
    adminProductionAppointments,
    adminProductionReport,
    adminProductionDetailReport,
    totals,
    receivables,
    openPaymentModal,
    openProcedurePaymentModal,
    handleRegisterPayment,
    handleRegisterCommissionPayment,
    handleRegisterExpense,
    handleOpenAttachmentUploader,
    handleAttachExpenseDocument,
    handleMarkExpensePaid,
    handleDeleteExpense,
    handleDeleteTransaction,
    handleDeletePackageInstallment,
    generateFinancialPdf,
    printReceipt,
    printTransactionReceipt,
  };
}

export type FinancialController = ReturnType<typeof useFinancialController>;

const FinancialContext = createContext<FinancialController | null>(null);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const value = useFinancialController();
  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial(): FinancialController {
  const context = useContext(FinancialContext);
  if (!context) throw new Error("useFinancial deve ser usado dentro de FinancialProvider");
  return context;
}

export function FinancialCard({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: typeof TrendingUp;
  danger?: boolean;
}) {
  return (
    <Card className={clsx("relative", danger ? "bg-rose-50/50 border-rose-100" : "")}>
      <div>
        <div className="min-w-0">
          <p
            className={clsx(
              "text-sm font-medium",
              danger ? "text-rose-600" : "text-slate-500",
            )}
          >
            {label}
          </p>
          <h3 className="mt-1 text-lg font-bold leading-tight text-slate-900 dark:text-white min-[390px]:text-xl sm:text-2xl">
            {currencyFormatter.format(value)}
          </h3>
        </div>
        <Icon
          className={clsx(
            "absolute right-6 top-6 hidden sm:block",
            danger ? "text-rose-600" : "text-brand-600",
          )}
          size={24}
        />
      </div>
    </Card>
  );
}

