// Grade de lançamento de aulas (Financeiro → Lançar aulas).
// Mesma regra da planilha de comissão (src/lib/commission.js →
// buildCommissionDetailReport): a aula conta para quem está na agenda, o dia
// é o dia local da aula, e aulas pagas = presenças + reposições + faltas.
// Arquivo .js para os testes em node (scripts/launch-grid.test.mjs).

/** Marca de cada status na grade. null = não aparece (cancelada). */
export function markOf(status) {
  switch (status) {
    case "presenca_registrada":
      return "P";
    case "reposicao":
      return "R";
    case "falta":
      return "F";
    case "ausencia_justificada":
      return "J";
    case "agendada":
    case "confirmada":
    case "scheduled":
    case "confirmed":
      return "A";
    case "cancelada":
    case "cancelled":
      return null;
    default:
      return "?";
  }
}

/** Marcas que entram na planilha de comissão (aulas pagas). */
export const PAID_MARKS = ["P", "R", "F"];

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Dia local (AAAA-MM-DD) de um horário, igual à planilha. */
export function localDay(isoDateTime) {
  const date = new Date(isoDateTime);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Hora HH:MM no fuso da clínica, igual à Agenda (Agendamentoservice). */
const CLINIC_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function localTime(isoDateTime) {
  return CLINIC_TIME.format(new Date(isoDateTime));
}

/** Todos os dias do mês "AAAA-MM". */
export function monthDays(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: last }, (_, index) => `${year}-${pad(monthNumber)}-${pad(index + 1)}`);
}

function emptyTotals() {
  return { presences: 0, makeups: 0, absences: 0, paid: 0, pending: 0, excused: 0 };
}

function addToTotals(totals, mark) {
  if (mark === "P") totals.presences += 1;
  if (mark === "R") totals.makeups += 1;
  if (mark === "F") totals.absences += 1;
  if (mark === "A") totals.pending += 1;
  if (mark === "J") totals.excused += 1;
  if (PAID_MARKS.includes(mark)) totals.paid += 1;
}

/**
 * Monta a grade de UMA fisioterapeuta num mês.
 *
 * @param appointments aulas do período (id, patient_id, professional_id,
 *   start_time, status, patients { full_name })
 * @param patients pacientes que devem aparecer mesmo sem aula (os ativos
 *   dela): { id, full_name }
 * @returns { days, rows: [{ patientId, name, cells: { [dia]: [{ id, mark,
 *   status, time }] }, totals }], totals }
 */
export function buildLaunchGrid({ appointments, patients, month, professionalId }) {
  const days = monthDays(month);
  const daySet = new Set(days);
  const rows = new Map();

  const rowFor = (patientId, name) => {
    if (!rows.has(patientId)) {
      rows.set(patientId, { patientId, name, cells: {}, totals: emptyTotals() });
    }
    return rows.get(patientId);
  };

  (patients ?? []).forEach((patient) => rowFor(patient.id, patient.full_name));

  (appointments ?? [])
    .filter((appointment) => appointment.professional_id === professionalId)
    .forEach((appointment) => {
      const mark = markOf(appointment.status);
      if (!mark) return;
      const day = localDay(appointment.start_time);
      if (!daySet.has(day)) return;
      const patientId = appointment.patient_id ?? "sem-paciente";
      const row = rowFor(patientId, appointment.patients?.full_name ?? "Paciente não informado");
      const cell = row.cells[day] ?? [];
      cell.push({
        id: appointment.id,
        mark,
        status: appointment.status,
        time: localTime(appointment.start_time),
        startTime: appointment.start_time,
      });
      cell.sort((a, b) => a.startTime.localeCompare(b.startTime));
      row.cells[day] = cell;
      addToTotals(row.totals, mark);
    });

  const sortedRows = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const totals = emptyTotals();
  sortedRows.forEach((row) => {
    Object.keys(totals).forEach((key) => {
      totals[key] += row.totals[key];
    });
  });

  return { days, rows: sortedRows, totals };
}

// ── Edição pela grade (bloco 2) ─────────────────────────────────────────────

/**
 * Se a célula pode ser editada pela grade e qual é a marca de partida.
 * Só dias até hoje; célula vazia, ou com UMA aula agendada, presença,
 * falta, reposição ou ausência justificada.
 */
export function editableCell(items, day, today) {
  if (day > today) return { editable: false, reason: "Dia futuro: lance pela Agenda." };
  const list = items ?? [];
  if (list.length === 0) return { editable: true, baseMark: null };
  if (list.length > 1) {
    return { editable: false, reason: "Mais de uma aula neste dia: ajuste pela Agenda." };
  }
  const [item] = list;
  if (["A", "P", "F", "R", "J"].includes(item.mark)) {
    return { editable: true, baseMark: item.mark, appointmentId: item.id };
  }
  return { editable: false, reason: "Status diferente: ajuste pela Agenda." };
}

/** Marcas que a pessoa pode escolher no menu da célula. */
export const CHOOSABLE_MARKS = ["P", "F", "R", "J"];

/** Horário mais frequente das aulas do paciente (para a aula nova). */
export function usualTime(row) {
  const counts = new Map();
  Object.values(row?.cells ?? {}).forEach((items) =>
    items.forEach((item) => counts.set(item.time, (counts.get(item.time) ?? 0) + 1)),
  );
  let best = null;
  counts.forEach((count, time) => {
    if (!best || count > best.count || (count === best.count && time < best.time)) {
      best = { time, count };
    }
  });
  return best?.time ?? null;
}
