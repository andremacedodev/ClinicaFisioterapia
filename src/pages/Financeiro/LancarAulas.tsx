import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { loadCommissionRules, type CommissionRule } from "../../lib/commissionRules";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { activeFirst, withInactiveLabel } from "../../lib/professionals";
import {
  buildLaunchGrid,
  editableCell,
  localDay,
  nextCellMark,
  usualTime,
  type LaunchAppointment,
  type LaunchCellItem,
  type LaunchMark,
} from "../../lib/launchGrid";
import {
  atualizarStatusAgendamento,
  criarAgendamento,
  getPacientes,
} from "../Agenda/Agendamentoservice";
import type { Paciente } from "../Agenda/types";
import { matchesPatientSearch, useFinancial } from "./financialCore";
import {
  buildLaunchForm,
  packageOverflow,
  suggestedTime,
} from "./launchForm";

type Professional = { id: string; full_name: string; role: string; active?: boolean };
type ShownMark = "A" | "P" | "F" | null;
/** Alteração pendente: chave "pacienteId|dia". */
type Pending = Record<string, ShownMark>;
type ChangeItem = {
  key: string;
  patientId: string;
  patientName: string;
  day: string;
  kind: "create" | "update";
  mark: "P" | "F" | "A";
  from: ShownMark;
  appointmentId?: string;
};
type SaveResult = { ok: number; failures: Array<{ label: string; reason: string }> };

const MARK_TO_STATUS = { P: "presenca_registrada", F: "falta", A: "agendada" } as const;
const MARK_WORD = { P: "Presença", F: "Falta", A: "Agendada" } as const;

const WEEKDAY_LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

const MARK_INFO: Record<LaunchMark, { label: string; className: string }> = {
  P: { label: "Presença", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  R: { label: "Reposição", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  F: { label: "Falta", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  J: { label: "Ausência justificada", className: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-300 dark:bg-slate-800 dark:text-slate-400" },
  A: { label: "Agendada (sem presença marcada)", className: "bg-white text-slate-500 ring-1 ring-inset ring-slate-300 dark:bg-slate-900 dark:text-slate-400" },
  "?": { label: "Outro status", className: "bg-slate-100 text-slate-500" },
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = MONTH_LABEL.format(new Date(year, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function cellTitle(name: string, day: string, items: LaunchCellItem[]): string {
  return `${name} · ${formatDay(day)}\n${items
    .map((item) => `${item.time} · ${MARK_INFO[item.mark].label}`)
    .join("\n")}`;
}

/**
 * Financeiro → Lançar aulas. Grade pacientes × dias de uma fisioterapeuta,
 * com a mesma contagem da planilha de comissão exportada.
 * Clicar numa célula lança P/F (cria a aula se não existir) ou marca a
 * presença de uma aula agendada. Nada é gravado antes de "Revisar e salvar".
 * Grava pelas mesmas funções da Agenda (pacote, comissão, recebimentos).
 */
export const FinancialLaunchClasses = () => {
  const { profile } = useAuth();
  const { patientSearchTerm } = useFinancial();
  const clinicId = profile?.clinic_id ?? null;
  const profileId = profile?.id ?? null;
  const profileRole = profile?.role ?? null;
  // Objeto estável para os serviços da Agenda (não refaz buscas a cada render).
  const access = useMemo(
    () => (profileId && clinicId && profileRole ? { id: profileId, clinic_id: clinicId, role: profileRole } : null),
    [profileId, clinicId, profileRole],
  );

  const [month, setMonth] = useState(currentMonth);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [appointments, setAppointments] = useState<LaunchAppointment[]>([]);
  const [patients, setPatients] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>({});
  const [agendaPatients, setAgendaPatients] = useState<Paciente[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<SaveResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Fisioterapeutas da clínica (ativas primeiro; inativas marcadas).
  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("clinic_id", clinicId)
        .eq("role", "physio")
        .order("full_name");
      if (cancelled) return;
      if (loadError) {
        setError(`Não foi possível carregar as fisioterapeutas: ${loadError.message}`);
        return;
      }
      const list = activeFirst((data ?? []) as Professional[]);
      setProfessionals(list);
      setProfessionalId((current) => current || list[0]?.id || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  // Pacientes com pacote/procedimento e regras de comissão (para criar aulas).
  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [list, rulesResult] = await Promise.all([
          getPacientes(access),
          loadCommissionRules(clinicId),
        ]);
        if (cancelled) return;
        setAgendaPatients(list);
        if (rulesResult.error) {
          setError(`Não foi possível carregar as regras de comissão: ${rulesResult.error}`);
        }
        setRules(rulesResult.rules);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            `Não foi possível carregar os pacotes dos pacientes: ${
              loadError instanceof Error ? loadError.message : String(loadError)
            }`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId, access]);

  const load = useCallback(async () => {
    if (!clinicId || !professionalId) return;
    setLoading(true);
    setError(null);
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);

    const [appointmentsResult, patientsResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, patient_id, professional_id, start_time, status, patients (full_name)")
        .eq("clinic_id", clinicId)
        .eq("professional_id", professionalId)
        .gte("start_time", start.toISOString())
        .lt("start_time", end.toISOString())
        .order("start_time"),
      supabase
        .from("patients")
        .select("id, full_name")
        .eq("clinic_id", clinicId)
        .eq("responsible_professional_id", professionalId)
        .eq("status", "ativo"),
    ]);
    setLoading(false);

    const failure = appointmentsResult.error ?? patientsResult.error;
    if (failure) {
      setError(`Não foi possível carregar as aulas: ${failure.message}`);
      return;
    }
    setAppointments((appointmentsResult.data ?? []) as unknown as LaunchAppointment[]);
    setPatients((patientsResult.data ?? []) as Array<{ id: string; full_name: string }>);
  }, [clinicId, professionalId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const grid = useMemo(
    () => buildLaunchGrid({ appointments, patients, month, professionalId }),
    [appointments, patients, month, professionalId],
  );

  const rows = useMemo(
    () => grid.rows.filter((row) => matchesPatientSearch(row.name, patientSearchTerm)),
    [grid.rows, patientSearchTerm],
  );

  const today = localDay(new Date().toISOString());
  // Aulas que já passaram e continuam "agendadas": provavelmente faltou lançar.
  const overdue = useMemo(
    () =>
      grid.rows.reduce(
        (total, row) =>
          total +
          Object.entries(row.cells).reduce(
            (sum, [day, items]) => sum + (day < today ? items.filter((item) => item.mark === "A").length : 0),
            0,
          ),
        0,
      ),
    [grid.rows, today],
  );

  const selected = professionals.find((professional) => professional.id === professionalId);

  const patientById = useMemo(
    () => new Map(agendaPatients.map((patient) => [patient.id, patient])),
    [agendaPatients],
  );

  // Lista de alterações pendentes, em ordem de paciente e data.
  const changes = useMemo<ChangeItem[]>(() => {
    const list: ChangeItem[] = [];
    grid.rows.forEach((row) => {
      grid.days.forEach((day) => {
        const key = `${row.patientId}|${day}`;
        if (!(key in pending)) return;
        const cell = editableCell(row.cells[day], day, today);
        if (!cell.editable) return;
        const shown = pending[key];
        if (shown === cell.baseMark || shown === null) return;
        list.push({
          key,
          patientId: row.patientId,
          patientName: row.name,
          day,
          kind: cell.appointmentId ? "update" : "create",
          mark: shown,
          from: cell.baseMark,
          appointmentId: cell.appointmentId,
        });
      });
    });
    return list;
  }, [grid, pending, today]);

  const creates = changes.filter((change) => change.kind === "create");
  const updates = changes.filter((change) => change.kind === "update");
  const hasPending = changes.length > 0;

  // Aviso do navegador ao fechar ou recarregar com lançamentos não salvos.
  useEffect(() => {
    if (!hasPending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPending]);

  const clickCell = (patientId: string, day: string, base: ShownMark) => {
    const key = `${patientId}|${day}`;
    setPending((current) => {
      const shown = key in current ? current[key] : base;
      const next = nextCellMark(base, shown) as ShownMark;
      const copy = { ...current };
      if (next === base) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    setResult(null);
  };

  const openReview = () => {
    const initial: Record<string, string> = {};
    creates.forEach((change) => {
      const row = grid.rows.find((item) => item.patientId === change.patientId);
      initial[change.key] = times[change.key] ?? suggestedTime(patientById.get(change.patientId), usualTime(row));
    });
    setTimes(initial);
    setReviewOpen(true);
  };

  const save = async () => {
    if (!clinicId || !professionalId) return;
    setSaving(true);
    setProgress({ done: 0, total: changes.length });
    const failures: SaveResult["failures"] = [];
    let ok = 0;
    const orderByPatient = new Map<string, number>();

    // Em ordem de data, uma de cada vez: o número da aula no pacote depende das anteriores.
    const ordered = [...changes].sort(
      (a, b) => a.day.localeCompare(b.day) || a.patientName.localeCompare(b.patientName),
    );
    for (const change of ordered) {
      const label = `${change.patientName}, ${formatDay(change.day)}`;
      try {
        if (change.kind === "update" && change.appointmentId) {
          await atualizarStatusAgendamento(change.appointmentId, MARK_TO_STATUS[change.mark]);
        } else if (change.mark === "P" || change.mark === "F") {
          const order = orderByPatient.get(change.patientId) ?? 0;
          orderByPatient.set(change.patientId, order + 1);
          const form = buildLaunchForm(
            {
              patient: patientById.get(change.patientId),
              patientId: change.patientId,
              professionalId,
              day: change.day,
              time: times[change.key] || "08:00",
              mark: change.mark,
              orderInPatient: order,
            },
            rules,
          );
          await criarAgendamento(clinicId, form);
        }
        ok += 1;
      } catch (saveError) {
        failures.push({
          label,
          reason: saveError instanceof Error ? saveError.message : String(saveError),
        });
      }
      setProgress((current) => ({ ...current, done: current.done + 1 }));
    }

    setSaving(false);
    setReviewOpen(false);
    setPending({});
    setResult({ ok, failures });
    await load();
    // Pacotes mudaram (aulas consumidas): recarrega para os próximos lançamentos.
    try {
      setAgendaPatients(await getPacientes(access));
    } catch {
      // A grade já foi recarregada; o erro de pacotes aparece no próximo carregamento.
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Fisioterapeuta
              <select
                className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={professionalId}
                disabled={hasPending}
                title={hasPending ? "Salve ou desfaça as alterações antes de trocar" : undefined}
                onChange={(event) => setProfessionalId(event.target.value)}
              >
                {professionals.length === 0 && <option value="">Nenhuma fisioterapeuta</option>}
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {withInactiveLabel(professional.full_name, professional)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span id="launch-month-label">Mês</span>
              <div className="flex items-center gap-1" role="group" aria-labelledby="launch-month-label">
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  onClick={() => setMonth((value) => shiftMonth(value, -1))}
                  disabled={hasPending}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[9.5rem] text-center font-semibold text-slate-900 dark:text-white">
                  {monthLabel(month)}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  onClick={() => setMonth((value) => shiftMonth(value, 1))}
                  disabled={hasPending}
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={hasPending}
            className="inline-flex min-h-11 disabled:opacity-50 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
            Atualizar
          </button>
        </div>
      </Card>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {result && (
        <div
          role="status"
          className={clsx(
            "rounded-xl border p-3 text-sm",
            result.failures.length
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
          )}
        >
          <p className="flex items-center gap-2 font-semibold">
            {result.failures.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {result.ok} {result.ok === 1 ? "lançamento salvo" : "lançamentos salvos"}
            {result.failures.length ? `, ${result.failures.length} com erro` : "."}
          </p>
          {result.failures.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.failures.map((failure) => (
                <li key={failure.label}>
                  <strong>{failure.label}:</strong> {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Aulas pagas", value: grid.totals.paid, hint: "presenças + reposições + faltas" },
          { label: "Presenças", value: grid.totals.presences + grid.totals.makeups, hint: grid.totals.makeups ? `${grid.totals.makeups} de reposição` : "" },
          { label: "Faltas", value: grid.totals.absences, hint: "" },
          {
            label: "Agendadas sem lançamento",
            value: overdue,
            hint: "dias que já passaram",
            warn: overdue > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={clsx(
              "rounded-xl border p-3",
              card.warn
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
            <p className="text-2xl font-bold tabular-nums">{card.value}</p>
            {card.hint && <p className="text-xs opacity-70">{card.hint}</p>}
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {selected ? selected.full_name : "Fisioterapeuta"} · {monthLabel(month)}
          </span>
          {(["P", "R", "F", "J", "A"] as LaunchMark[]).map((mark) => (
            <span key={mark} className="inline-flex items-center gap-1.5">
              <span className={clsx("inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold", MARK_INFO[mark].className)}>
                {mark}
              </span>
              {MARK_INFO[mark].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-400">
              A
            </span>
            Já passou e falta lançar
          </span>
        </div>

        {loading && grid.rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="animate-spin" size={20} /> Carregando aulas…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            {grid.rows.length === 0
              ? "Nenhum paciente ou aula desta fisioterapeuta neste mês."
              : "Nenhum paciente encontrado na busca."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                Aulas de {selected?.full_name} em {monthLabel(month)}: pacientes nas linhas e dias nas colunas
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 min-w-[11rem] border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                  >
                    Paciente
                  </th>
                  {[
                    ["Pres.", "Presenças (inclui reposições)"],
                    ["Faltas", "Faltas"],
                    ["Pagas", "Aulas pagas"],
                  ].map(([short, full]) => (
                    <th
                      key={short}
                      scope="col"
                      title={full}
                      className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      {short}
                    </th>
                  ))}
                  {grid.days.map((day) => {
                    const date = new Date(`${day}T12:00:00`);
                    const weekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th
                        key={day}
                        scope="col"
                        className={clsx(
                          "w-9 min-w-[2.25rem] border-b border-slate-200 px-0.5 py-1 text-center text-[11px] font-medium dark:border-slate-800",
                          weekend ? "bg-slate-100 text-slate-500 dark:bg-slate-800/60" : "bg-white text-slate-600 dark:bg-slate-900",
                          day === today && "text-brand-700 dark:text-brand-300",
                        )}
                        aria-label={formatDay(day)}
                      >
                        <span className="block text-[10px] opacity-70">{WEEKDAY_LETTER[date.getDay()]}</span>
                        <span className={clsx("block font-semibold", day === today && "rounded bg-brand-100 dark:bg-brand-900/40")}>
                          {Number(day.slice(-2))}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.patientId} className={index % 2 ? "bg-slate-50/60 dark:bg-slate-900/40" : undefined}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[14rem] truncate border-b border-r border-slate-200 bg-white px-3 py-1.5 text-left font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      title={row.name}
                    >
                      {row.name}
                    </th>
                    <td className="border-b border-slate-200 px-2 text-center tabular-nums dark:border-slate-800">
                      {row.totals.presences + row.totals.makeups}
                    </td>
                    <td className="border-b border-slate-200 px-2 text-center tabular-nums dark:border-slate-800">
                      {row.totals.absences}
                    </td>
                    <td className="border-b border-r border-slate-200 px-2 text-center font-semibold tabular-nums dark:border-slate-800">
                      {row.totals.paid}
                    </td>
                    {grid.days.map((day) => {
                      const items = row.cells[day] ?? [];
                      const date = new Date(`${day}T12:00:00`);
                      const weekend = date.getDay() === 0 || date.getDay() === 6;
                      const key = `${row.patientId}|${day}`;
                      const cell = editableCell(items, day, today);
                      const base = cell.editable ? cell.baseMark : null;
                      const shown = cell.editable && key in pending ? pending[key] : base;
                      const changed = cell.editable && key in pending && shown !== base;
                      const isNew = changed && !cell.appointmentId;
                      const describe = items.length ? cellTitle(row.name, day, items) : `${row.name} · ${formatDay(day)}`;
                      return (
                        <td
                          key={day}
                          className={clsx(
                            "border-b border-slate-100 p-0.5 text-center align-middle dark:border-slate-800",
                            weekend && "bg-slate-100/70 dark:bg-slate-800/40",
                          )}
                        >
                          {cell.editable ? (
                            <button
                              type="button"
                              onClick={() => clickCell(row.patientId, day, base)}
                              disabled={saving}
                              className={clsx(
                                "group inline-flex h-8 w-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500",
                                !shown && "hover:bg-brand-50 dark:hover:bg-brand-900/30",
                              )}
                              title={`${describe}\nClique para lançar: presença → falta → ${base === "A" ? "agendada" : base ? (base === "P" ? "presença" : "falta") : "vazio"}`}
                              aria-label={`${row.name}, ${formatDay(day)}: ${
                                shown ? MARK_WORD[shown] : "sem aula"
                              }${changed ? " (alteração não salva)" : ""}. Clique para mudar.`}
                            >
                              {shown ? (
                                <span
                                  className={clsx(
                                    "relative inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                                    shown === "A" && day < today && !changed
                                      ? "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-400 dark:bg-amber-900/40 dark:text-amber-200"
                                      : MARK_INFO[shown].className,
                                    changed && "ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900",
                                  )}
                                >
                                  {shown}
                                  {isNew && (
                                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                                  )}
                                </span>
                              ) : (
                                <span className="h-1 w-1 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100" aria-hidden="true" />
                              )}
                            </button>
                          ) : items.length > 0 ? (
                            <button
                              type="button"
                              className="inline-flex cursor-help flex-col items-center gap-0.5 rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                              title={`${describe}\n${cell.reason}`}
                              aria-label={`${describe.replace(/\n/g, ". ")}. ${cell.reason}`}
                              onClick={() => setHint(`${row.name}, ${formatDay(day)}: ${cell.reason}`)}
                            >
                              {items.map((item) => (
                                <span
                                  key={item.id}
                                  className={clsx(
                                    "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                                    item.mark === "A" && day < today
                                      ? "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-400 dark:bg-amber-900/40 dark:text-amber-200"
                                      : MARK_INFO[item.mark].className,
                                  )}
                                >
                                  {item.mark}
                                </span>
                              ))}
                            </button>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Clique numa célula para lançar: presença → falta → volta como estava. Dias futuros,
        reposições, ausências justificadas e dias com duas aulas são ajustados pela Agenda. A
        contagem é a mesma da planilha de comissão exportada.
      </p>

      {hint && (
        <p className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span>{hint}</span>
          <button type="button" onClick={() => setHint(null)} aria-label="Fechar aviso" className="text-slate-400">
            <X size={16} />
          </button>
        </p>
      )}

      {hasPending && (
        <div className="sticky bottom-20 z-30 lg:bottom-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-xl sm:flex-row sm:items-center sm:justify-between dark:border-brand-900 dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <strong>{changes.length}</strong> {changes.length === 1 ? "alteração não salva" : "alterações não salvas"}
              {creates.length > 0 && ` · ${creates.length} ${creates.length === 1 ? "aula nova" : "aulas novas"}`}
              {updates.length > 0 && ` · ${updates.length} ${updates.length === 1 ? "aula alterada" : "aulas alteradas"}`}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPending({})} disabled={saving}>
                <RotateCcw size={16} className="mr-1.5" /> Desfazer
              </Button>
              <Button onClick={openReview} disabled={saving}>
                Revisar e salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="launch-review-title">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Fechar revisão"
            onClick={() => !saving && setReviewOpen(false)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <h2 id="launch-review-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Revisar lançamentos
              </h2>
              <p className="text-sm text-slate-500">
                {selected?.full_name} · {monthLabel(month)}
              </p>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
              {creates.length > 0 && (
                <section>
                  <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">
                    Criar {creates.length} {creates.length === 1 ? "aula" : "aulas"}
                  </h3>
                  <p className="mb-2 text-xs text-slate-500">
                    Com o valor do pacote (ou do procedimento) e a comissão pela regra de {selected?.full_name?.split(" ")[0]}. Confira o horário.
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {creates.map((change) => {
                      const patient = patientById.get(change.patientId);
                      const newForPatient = creates.filter((item) => item.patientId === change.patientId).length;
                      const overflow = packageOverflow(patient, newForPatient);
                      return (
                        <li key={change.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {change.patientName} · {formatDay(change.day)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {MARK_WORD[change.mark]}
                              {patient?.pacoteAtivo
                                ? ` · pacote de ${patient.pacoteAtivo.totalAulas} aulas`
                                : patient?.procedimentos?.[0]
                                  ? ` · ${patient.procedimentos[0].name} (avulso)`
                                  : " · sem pacote nem procedimento (valor R$ 0)"}
                            </p>
                            {overflow && (
                              <p className="text-xs font-medium text-amber-700">
                                O pacote já está com todas as aulas usadas; confira se precisa renovar.
                              </p>
                            )}
                          </div>
                          <label className="flex items-center gap-2 text-xs text-slate-600">
                            Horário
                            <input
                              type="time"
                              className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                              value={times[change.key] ?? "08:00"}
                              onChange={(event) =>
                                setTimes((current) => ({ ...current, [change.key]: event.target.value }))
                              }
                              disabled={saving}
                            />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {updates.length > 0 && (
                <section>
                  <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">
                    Alterar {updates.length} {updates.length === 1 ? "aula" : "aulas"}
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {updates.map((change) => (
                      <li key={change.key} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {change.patientName} · {formatDay(change.day)}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {change.from ? MARK_WORD[change.from] : "—"} → <strong>{MARK_WORD[change.mark]}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-end dark:border-slate-800">
              {saving && (
                <p className="mr-auto flex items-center gap-2 text-sm text-slate-600" role="status">
                  <Loader2 size={16} className="animate-spin" /> Salvando {progress.done} de {progress.total}…
                </p>
              )}
              <Button variant="ghost" onClick={() => setReviewOpen(false)} disabled={saving}>
                Voltar
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                Salvar {changes.length} {changes.length === 1 ? "lançamento" : "lançamentos"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
