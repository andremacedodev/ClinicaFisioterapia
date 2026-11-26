// Tipos de src/lib/birthdays.js.

export type BirthdaySource = {
  id: string;
  full_name: string;
  phone?: string | null;
  birth_date?: string | null;
};

export type UpcomingBirthday = {
  id: string;
  name: string;
  phone: string | null;
  birthDate: string;
  label: string;
  age: number;
  daysUntil: number;
};

export declare function birthdayLabel(daysUntil: number, date: Date): string;

export declare function upcomingBirthdays(
  patients: BirthdaySource[] | null | undefined,
  reference?: Date,
  days?: number,
): UpcomingBirthday[];

export declare function whatsappLink(phone: string | null | undefined): string | null;
