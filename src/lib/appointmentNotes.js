// Observações da aula montadas ao editar/remarcar na Agenda.
// Arquivo .js para os testes em node (scripts/appointment-notes.test.mjs).

const RESCHEDULE_PATTERN =
  /Remarcação: de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}-\d{2}:\d{2} para \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}-\d{2}:\d{2}\.?/g;
const MANUAL_CORRECTION_TAG = "[CORREÇÃO AVULSA]";

function cleanText(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Separa as observações escritas pela clínica das linhas automáticas.
 * Retorna o texto sem remarcações nem a marca de correção avulsa, a última
 * remarcação encontrada e se a marca existia.
 */
export function splitAppointmentNotes(notes) {
  const text = notes ?? "";
  const reschedules = text.match(RESCHEDULE_PATTERN) ?? [];
  const lastReschedule = reschedules.length
    ? reschedules[reschedules.length - 1].replace(/\.?$/, ".")
    : "";
  const hadManualCorrection = text.includes(MANUAL_CORRECTION_TAG);
  const userText = cleanText(
    text.replace(RESCHEDULE_PATTERN, "").split(MANUAL_CORRECTION_TAG).join(""),
  );
  return { userText, lastReschedule, hadManualCorrection };
}

/**
 * Monta as observações para salvar: a marca de correção avulsa (uma vez),
 * o texto da clínica e SÓ a remarcação mais recente.
 */
export function buildAppointmentNotes({ notes, manualCorrection = false, newReschedule = "" }) {
  const { userText, lastReschedule, hadManualCorrection } = splitAppointmentNotes(notes);
  return [
    manualCorrection || hadManualCorrection ? MANUAL_CORRECTION_TAG : "",
    userText,
    newReschedule || lastReschedule,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Mesmo horário? Compara o instante, não o texto (o banco devolve outro formato). */
export function isSameInstant(a, b) {
  const timeA = new Date(a).getTime();
  const timeB = new Date(b).getTime();
  if (Number.isNaN(timeA) || Number.isNaN(timeB)) return a === b;
  return timeA === timeB;
}
