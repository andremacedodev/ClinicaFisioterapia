// Tipos de src/lib/appointmentNotes.js.

export declare function splitAppointmentNotes(notes: string | null | undefined): {
  userText: string;
  lastReschedule: string;
  hadManualCorrection: boolean;
};

export declare function buildAppointmentNotes(options: {
  notes: string | null | undefined;
  manualCorrection?: boolean;
  newReschedule?: string;
}): string;

export declare function isSameInstant(a: string, b: string): boolean;
