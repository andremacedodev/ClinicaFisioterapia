/*
  Monta a aula criada pela grade (Financeiro → Lançar aulas) no mesmo formato
  que a Agenda envia para criarAgendamento: pacote ativo (número da aula,
  valor por aula, "Pilates") ou procedimento avulso (valor combinado), e a
  comissão pela regra de QUEM DÁ a aula na data da aula.
*/
import {
  currentCommissionRule,
  suggestedCommission,
  type CommissionRule,
} from "../../lib/commissionRules";
import { SESSION_DURATION_MINUTES } from "../Agenda/Agendamentoservice";
import type { NovoAgendamentoForm, Paciente, TipoSessao } from "../Agenda/types";

const TIPOS: TipoSessao[] = [
  "RPG",
  "Drenagem linfática",
  "Liberação miofascial",
  "Massagem relaxante",
  "Pilates",
  "Fisioterapia",
  "Fisioterapia pélvica",
];

function addMinutes(time: string, minutes: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes, 0);
  return date.toTimeString().slice(0, 5);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type LaunchCreate = {
  patient: Paciente | undefined;
  patientId: string;
  professionalId: string;
  day: string;
  time: string;
  /** P presença, F falta, R reposição, J ausência justificada. */
  mark: "P" | "F" | "R" | "J";
  /** Posição desta aula entre as novas do mesmo paciente (0, 1, 2…), em ordem de data. */
  orderInPatient: number;
  /** Fisioterapeuta comissionada? A administradora (dona) não recebe comissão. */
  commissioned?: boolean;
};

/** Próximo número de aula do pacote, contando as novas que vêm antes. */
export function sessionNumberFor(patient: Paciente | undefined, orderInPatient: number): number {
  const pacote = patient?.pacoteAtivo;
  if (!pacote) return 1;
  const consumed = pacote.aulasRealizadas + pacote.aulasFaltadas;
  return Math.min(consumed + 1 + orderInPatient, pacote.totalAulas);
}

/** Pacote já tem todas as aulas usadas (contando as novas)? */
export function packageOverflow(patient: Paciente | undefined, newCount: number): boolean {
  const pacote = patient?.pacoteAtivo;
  if (!pacote) return false;
  return pacote.aulasRealizadas + pacote.aulasFaltadas + newCount > pacote.totalAulas;
}

/** Horário sugerido: fixo do pacote, senão o mais comum no mês, senão 08:00. */
export function suggestedTime(patient: Paciente | undefined, usual: string | null): string {
  return patient?.pacoteAtivo?.horarioFixo || usual || "08:00";
}

export function buildLaunchForm(
  create: LaunchCreate,
  rules: CommissionRule[],
): NovoAgendamentoForm {
  const { patient, patientId, professionalId, day, time, mark, orderInPatient } = create;
  const commissioned = create.commissioned ?? true;
  const pacote = patient?.pacoteAtivo;
  const procedure = patient?.procedimentos?.[0];
  const classValue = pacote ? pacote.valorAula : Number(procedure?.agreed_value) || 0;
  const when = new Date(`${day}T${time}:00`);
  const rule = currentCommissionRule(rules, professionalId, when);
  const commission =
    commissioned && (rule?.commission_type === "fixed" || classValue)
      ? round2(suggestedCommission(rules, professionalId, classValue, when))
      : 0;
  const sessionNumber = sessionNumberFor(patient, orderInPatient);

  return {
    pacienteId: patientId,
    fisioterapeutaId: professionalId,
    data: day,
    horaInicio: time,
    horaFim: addMinutes(time, SESSION_DURATION_MINUTES),
    tipoSessao: pacote
      ? "Pilates"
      : TIPOS.includes(procedure?.name as TipoSessao)
        ? (procedure?.name as TipoSessao)
        : "Fisioterapia",
    // Ausência justificada é criada como agendada e depois marcada com
    // atualizarStatusAgendamento, que aplica o limite do pacote (igual à Agenda).
    status:
      mark === "P"
        ? "presenca_registrada"
        : mark === "F"
          ? "falta"
          : mark === "R"
            ? "reposicao"
            : "agendada",
    observacoes: pacote
      ? `Lançada pela grade. Aula ${sessionNumber}/${pacote.totalAulas} do pacote.`
      : "Lançada pela grade.",
    sessaoNumero: sessionNumber,
    totalSessoes: pacote?.totalAulas ?? (Number(procedure?.quantity) || 1),
    pacoteId: pacote?.id,
    valorAula: classValue || undefined,
    valorComissao: commission || undefined,
  };
}
