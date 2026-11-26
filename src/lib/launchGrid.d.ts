// Tipos de src/lib/launchGrid.js.

export type LaunchMark = "P" | "R" | "F" | "J" | "A" | "?";

export type LaunchCellItem = {
  id: string;
  mark: LaunchMark;
  status: string;
  time: string;
  startTime: string;
};

export type LaunchTotals = {
  presences: number;
  makeups: number;
  absences: number;
  paid: number;
  pending: number;
  excused: number;
};

export type LaunchRow = {
  patientId: string;
  name: string;
  cells: Record<string, LaunchCellItem[]>;
  totals: LaunchTotals;
};

export type LaunchAppointment = {
  id: string;
  patient_id: string | null;
  professional_id: string | null;
  start_time: string;
  status: string;
  patients?: { full_name?: string | null } | null;
};

export declare const PAID_MARKS: LaunchMark[];
export declare function markOf(status: string): LaunchMark | null;
export declare function localDay(isoDateTime: string): string;
export declare function localTime(isoDateTime: string): string;
export declare function monthDays(month: string): string[];
export declare function buildLaunchGrid(options: {
  appointments: LaunchAppointment[] | null | undefined;
  patients: Array<{ id: string; full_name: string }> | null | undefined;
  month: string;
  professionalId: string;
}): { days: string[]; rows: LaunchRow[]; totals: LaunchTotals };

export type EditableMark = "A" | "P" | "F" | "R" | "J";

export type EditableCell =
  | { editable: true; baseMark: EditableMark | null; appointmentId?: string }
  | { editable: false; reason: string };

export declare function editableCell(
  items: LaunchCellItem[] | undefined,
  day: string,
  today: string,
): EditableCell;

export declare const CHOOSABLE_MARKS: Array<"P" | "F" | "R" | "J">;

export declare function usualTime(row: LaunchRow | undefined): string | null;
