// Tipos de src/lib/commission.js (o .js também é usado pelos testes em node).

export type CommissionRuleLike = {
  professional_id: string;
  commission_type: "percent" | "fixed" | string;
  commission_value: number | string;
  valid_from: string;
  created_at?: string;
};

export type CommissionAppointmentLike = {
  start_time: string;
  commission_amount?: number | string | null;
};

export type CommissionReportItem = {
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

export declare const DEFAULT_COMMISSION_RULE: Readonly<{
  commission_type: "percent";
  commission_value: number;
}>;

export declare function findCommissionRule<T extends CommissionRuleLike>(
  rules: T[] | null | undefined,
  professionalId: string | null | undefined,
  when: string | number | Date,
): T | null;

export declare function commissionFromRule(
  rule: Pick<CommissionRuleLike, "commission_type" | "commission_value"> | null | undefined,
  classValue: number | string | null | undefined,
): number;

export declare function getCommissionAmount(
  appointment: CommissionAppointmentLike,
  classValue: number,
  rules?: CommissionRuleLike[],
  professionalId?: string | null,
): number;

export declare function isCommissionableAppointment(status: string): boolean;

// Os relatórios aceitam as linhas de agendamento como vêm do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppointmentRow = any;

export declare function buildCommissionReport(
  appointments: AppointmentRow[],
  ownerId?: string | null,
  startDate?: string,
  endDate?: string,
  commissionRules?: CommissionRuleLike[],
): CommissionReportItem[];

export declare function buildCommissionDetailReport(
  appointments: AppointmentRow[],
  ownerId: string | null,
  startDate: string,
  endDate: string,
  commissionRules?: CommissionRuleLike[],
): CommissionDetailRow[];
