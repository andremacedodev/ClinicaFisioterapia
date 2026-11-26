// Aniversariantes: usado pelo painel e pelo sino de avisos.
// Arquivo .js para os testes em node (scripts/birthdays.test.mjs).

const DAY_MS = 86_400_000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function birthdayInYear(birthDate, year) {
  const [, month, day] = birthDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function ageOn(birthDate, date) {
  const [year] = birthDate.split("-").map(Number);
  let age = date.getFullYear() - year;
  if (birthdayInYear(birthDate, date.getFullYear()) > date) age -= 1;
  return age;
}

export function birthdayLabel(daysUntil, date) {
  if (daysUntil === 0) return "Hoje";
  if (daysUntil === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Pacientes que fazem aniversário de hoje até `days` dias à frente,
 * ordenados por proximidade e nome.
 */
export function upcomingBirthdays(patients, reference = new Date(), days = 7) {
  const today = startOfDay(reference);
  return (patients ?? [])
    .filter((patient) => Boolean(patient.birth_date))
    .map((patient) => {
      const thisYear = birthdayInYear(patient.birth_date, today.getFullYear());
      const next =
        thisYear < today ? birthdayInYear(patient.birth_date, today.getFullYear() + 1) : thisYear;
      const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
      return {
        id: patient.id,
        name: patient.full_name,
        phone: patient.phone ?? null,
        birthDate: patient.birth_date,
        label: birthdayLabel(daysUntil, next),
        age: ageOn(patient.birth_date, next),
        daysUntil,
      };
    })
    .filter((birthday) => birthday.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

/** Link do WhatsApp do paciente (Brasil), ou null sem telefone. */
export function whatsappLink(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`}`;
}
