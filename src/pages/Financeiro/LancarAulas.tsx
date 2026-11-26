import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { activeFirst, withInactiveLabel } from "../../lib/professionals";
import {
  buildLaunchGrid,
  localDay,
  type LaunchAppointment,
  type LaunchCellItem,
  type LaunchMark,
} from "../../lib/launchGrid";
import { matchesPatientSearch, useFinancial } from "./financialCore";

type Professional = { id: string; full_name: string; role: string; active?: boolean };

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
 * Bloco 1: só visualização (conferência). O lançamento vem no bloco 2.
 */
export const FinancialLaunchClasses = () => {
  const { profile } = useAuth();
  const { patientSearchTerm } = useFinancial();
  const clinicId = profile?.clinic_id ?? null;

  const [month, setMonth] = useState(currentMonth);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [appointments, setAppointments] = useState<LaunchAppointment[]>([]);
  const [patients, setPatients] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
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
                      return (
                        <td
                          key={day}
                          className={clsx(
                            "border-b border-slate-100 px-0.5 py-1 text-center align-middle dark:border-slate-800",
                            weekend && "bg-slate-100/70 dark:bg-slate-800/40",
                          )}
                          title={items.length ? cellTitle(row.name, day, items) : undefined}
                        >
                          {items.length > 0 && (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              {items.map((item) => (
                                <span
                                  key={item.id}
                                  className={clsx(
                                    "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                                    item.mark === "A" && day < today
                                      ? "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-400 dark:bg-amber-900/40 dark:text-amber-200"
                                      : MARK_INFO[item.mark].className,
                                  )}
                                  aria-label={`${formatDay(day)} ${item.time}: ${MARK_INFO[item.mark].label}${item.mark === "A" && day < today ? ", falta lançar" : ""}`}
                                >
                                  {item.mark}
                                </span>
                              ))}
                            </span>
                          )}
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
        A contagem é a mesma da planilha de comissão exportada. Por enquanto esta tela é só para
        conferir; o lançamento direto aqui vem na próxima etapa.
      </p>
    </div>
  );
};
