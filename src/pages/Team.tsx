import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, Percent, Plus, RotateCcw, UserCheck, UserX, X } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import { messages } from "../i18n";
import { supabase } from "../lib/supabase";
import {
  currentCommissionRule,
  formatCommission,
  loadCommissionRules,
  type CommissionRule,
} from "../lib/commissionRules";
import {
  CommissionDraft,
  CommissionFields,
  commissionDraftError,
  draftFromRule,
  parseCommissionValue,
} from "../components/commission/CommissionFields";

type TeamProfile = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  deactivated_at: string | null;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
};

type PendingSummary = {
  future_appointments: number;
  responsible_patients: number;
  active_packages: number;
};

type DeactivationResult = {
  moved_appointments: number;
  moved_patients: number;
  moved_packages: number;
};

const MISSING_MIGRATION_MESSAGE =
  "O banco ainda não recebeu a atualização de inativação de profissionais " +
  "(migration 20261106000000_professional_deactivation.sql). Aplique-a no Supabase.";

// Mensagem do banco quando a coluna/função nova ainda não existe.
const MISSING_COMMISSION_MIGRATION_MESSAGE =
  "O banco ainda não recebeu a atualização de comissão configurável " +
  "(migration 20261112000000_configurable_commission.sql). Aplique-a no Supabase.";

function friendlyError(message: string): string {
  if (
    /(commission_type|commission_value|default_commission|set_professional_commission|professional_commission_rules)/i.test(message) &&
    /(does not exist|could not find|schema cache)/i.test(message)
  ) {
    return MISSING_COMMISSION_MIGRATION_MESSAGE;
  }
  if (
    /column .*active.* does not exist/i.test(message) ||
    (/deactivate_professional|reactivate_professional|professional_pending_summary/i.test(message) &&
      /(does not exist|could not find|schema cache)/i.test(message))
  ) {
    return MISSING_MIGRATION_MESSAGE;
  }
  return message;
}

function roleLabel(role: string): string {
  if (role === "admin") return messages.team.roles.admin;
  if (role === "physio") return messages.team.roles.physio;
  return role;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR");
}

export const Team = () => {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamProfile | null>(null);
  const [commissionTarget, setCommissionTarget] = useState<TeamProfile | null>(null);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [commissionSupported, setCommissionSupported] = useState(false);
  const [defaultCommission, setDefaultCommission] = useState<CommissionDraft>(draftFromRule(null));
  const [inviteCommission, setInviteCommission] = useState<CommissionDraft>(draftFromRule(null));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  const activeProfiles = useMemo(
    () => profiles.filter((item) => item.active),
    [profiles],
  );
  const inactiveProfiles = useMemo(
    () => profiles.filter((item) => !item.active),
    [profiles],
  );

  const loadTeam = async () => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [profilesResult, invitationsResult, clinicResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, active, deactivated_at")
        .eq("clinic_id", profile.clinic_id)
        .order("full_name", { ascending: true }),
      supabase
        .from("professional_invitations")
        .select("id, email, full_name, role, status, created_at")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("clinics")
        .select("owner_id, default_commission_type, default_commission_value")
        .eq("id", profile.clinic_id)
        .maybeSingle(),
    ]);

    // Banco sem a migration de comissão: carrega sem as colunas novas.
    let finalClinicResult = clinicResult;
    if (clinicResult.error && /default_commission/.test(clinicResult.error.message)) {
      console.warn(MISSING_COMMISSION_MIGRATION_MESSAGE);
      finalClinicResult = (await supabase
        .from("clinics")
        .select("owner_id")
        .eq("id", profile.clinic_id)
        .maybeSingle()) as typeof clinicResult;
    }

    const failed = [profilesResult, invitationsResult, finalClinicResult].find(
      (result) => result.error,
    );
    if (failed?.error) {
      setError(friendlyError(failed.error.message));
      setLoading(false);
      return;
    }

    setProfiles((profilesResult.data ?? []) as TeamProfile[]);
    setInvitations((invitationsResult.data ?? []) as Invitation[]);
    const clinicRow = finalClinicResult.data as {
      owner_id?: string | null;
      default_commission_type?: string;
      default_commission_value?: number | string;
    } | null;
    setOwnerId(clinicRow?.owner_id ?? null);

    const rulesResult = await loadCommissionRules(profile.clinic_id);
    if (rulesResult.error) {
      setError(`Erro ao carregar as comissões: ${rulesResult.error}`);
    }
    setCommissionRules(rulesResult.rules);
    setCommissionSupported(rulesResult.supported && !!clinicRow?.default_commission_type);
    if (clinicRow?.default_commission_type) {
      const clinicDefault = draftFromRule({
        commission_type: clinicRow.default_commission_type,
        commission_value: clinicRow.default_commission_value ?? 40,
      });
      setDefaultCommission(clinicDefault);
      setInviteCommission(clinicDefault);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTeam();
  }, [profile?.clinic_id]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.clinic_id || !isAdmin) return;

    if (commissionSupported) {
      const validation = commissionDraftError(inviteCommission);
      if (validation) {
        setError(`Comissão do convite: ${validation}`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { error } = await supabase.from("professional_invitations").insert({
      clinic_id: profile.clinic_id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: "physio",
      created_by: profile.id,
      ...(commissionSupported
        ? {
            commission_type: inviteCommission.type,
            commission_value: parseCommissionValue(inviteCommission.value),
          }
        : {}),
    });

    if (error) {
      setError(friendlyError(error.message));
      setSaving(false);
      return;
    }

    setFullName("");
    setEmail("");
    setInviteCommission(defaultCommission);
    setSaving(false);
    await loadTeam();
  };

  const handleReactivate = async (item: TeamProfile) => {
    if (
      !window.confirm(
        `Reativar o acesso de ${item.full_name}? Ela volta a entrar no sistema e a aparecer nas listas de profissionais.`,
      )
    ) {
      return;
    }

    setReactivatingId(item.id);
    setError(null);
    setNotice(null);

    const { error } = await supabase.rpc("reactivate_professional", {
      p_professional_id: item.id,
    });

    setReactivatingId(null);

    if (error) {
      setError(`Não foi possível reativar ${item.full_name}: ${friendlyError(error.message)}`);
      return;
    }

    setNotice(`${item.full_name} foi reativada.`);
    await loadTeam();
  };

  const handleDeactivated = async (
    item: TeamProfile,
    result: DeactivationResult,
    receiverName: string | null,
  ) => {
    setDeactivateTarget(null);
    setError(null);

    const moved = [
      result.moved_appointments > 0 &&
        plural(result.moved_appointments, "agendamento", "agendamentos"),
      result.moved_patients > 0 &&
        plural(result.moved_patients, "paciente", "pacientes"),
      result.moved_packages > 0 &&
        plural(result.moved_packages, "pacote", "pacotes"),
    ].filter(Boolean);

    setNotice(
      moved.length > 0 && receiverName
        ? `${item.full_name} foi inativada. Transferidos para ${receiverName}: ${moved.join(", ")}.`
        : `${item.full_name} foi inativada.`,
    );
    await loadTeam();
  };

  const canDeactivate = (item: TeamProfile) =>
    item.id !== profile?.id && item.id !== ownerId;

  if (!isAdmin) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Acesso restrito
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Apenas a administradora pode gerenciar a equipe.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Equipe
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Convide fisioterapeutas para acessarem somente seus pacientes, agenda
          e produção.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <Card title="Convidar fisioterapeuta">
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <div className="relative">
            <UserCheck
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              required
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Nome da fisioterapeuta"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              required
              type="email"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" className="order-last gap-2 md:order-none" isLoading={saving}>
            <Plus size={18} /> Convidar
          </Button>
          {commissionSupported && (
            <div className="md:col-span-3 max-w-xl space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Comissão desta fisioterapeuta
              </p>
              <CommissionFields
                idPrefix="invite"
                value={inviteCommission}
                onChange={setInviteCommission}
                disabled={saving}
              />
            </div>
          )}
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Profissionais ativos">
          {loading ? (
            <p className="text-sm text-slate-500">Carregando equipe...</p>
          ) : activeProfiles.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum profissional ativo.</p>
          ) : (
            <div className="space-y-3">
              {activeProfiles.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {item.full_name}
                      {item.id === profile?.id && (
                        <span className="ml-2 text-xs font-normal text-slate-400">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.id === ownerId
                        ? "Dona da clínica · sem comissão"
                        : commissionSupported
                          ? `Comissão: ${formatCommission(currentCommissionRule(commissionRules, item.id))}`
                          : roleLabel(item.role)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    <Badge variant={item.role === "admin" ? "info" : "success"}>
                      {roleLabel(item.role)}
                    </Badge>
                    {commissionSupported && item.id !== ownerId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setNotice(null);
                          setCommissionTarget(item);
                        }}
                      >
                        <Percent size={14} /> Comissão
                      </Button>
                    )}
                    {canDeactivate(item) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                        onClick={() => {
                          setNotice(null);
                          setDeactivateTarget(item);
                        }}
                      >
                        <UserX size={14} /> Inativar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Convites">
          <div className="space-y-3">
            {invitations.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum convite enviado.</p>
            ) : (
              invitations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {item.full_name}
                    </p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </div>
                  <Badge
                    variant={item.status === "accepted" ? "success" : "warning"}
                  >
                    {item.status === "accepted"
                      ? messages.team.invitationStatus.accepted
                      : messages.team.invitationStatus.pending}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {!loading && inactiveProfiles.length > 0 && (
        <Card
          title="Profissionais inativos"
          subtitle="Sem acesso ao sistema. O histórico de atendimentos, evoluções e comissões continua com o nome delas."
        >
          <div className="space-y-3">
            {inactiveProfiles.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {item.full_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {roleLabel(item.role)}
                    {item.deactivated_at && ` · inativada em ${formatDate(item.deactivated_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="neutral">Inativa</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    isLoading={reactivatingId === item.id}
                    onClick={() => handleReactivate(item)}
                  >
                    {reactivatingId !== item.id && <RotateCcw size={14} />} Reativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {commissionTarget && (
        <CommissionModal
          professional={commissionTarget}
          rules={commissionRules.filter((rule) => rule.professional_id === commissionTarget.id)}
          onClose={() => setCommissionTarget(null)}
          onSaved={(rule) => {
            setCommissionRules((current) => [...current, rule]);
            setNotice(
              `Comissão de ${commissionTarget.full_name} alterada para ${formatCommission(rule)}. Vale para as aulas a partir de agora.`,
            );
            setCommissionTarget(null);
          }}
        />
      )}

      {deactivateTarget && (
        <DeactivateProfessionalModal
          professional={deactivateTarget}
          receivers={activeProfiles.filter(
            (item) =>
              item.id !== deactivateTarget.id &&
              (item.role === "admin" || item.role === "physio"),
          )}
          onClose={() => setDeactivateTarget(null)}
          onDone={handleDeactivated}
        />
      )}
    </div>
  );
};

type DeactivateModalProps = {
  professional: TeamProfile;
  receivers: TeamProfile[];
  onClose: () => void;
  onDone: (
    professional: TeamProfile,
    result: DeactivationResult,
    receiverName: string | null,
  ) => void;
};

const KEEP_WITH_PROFESSIONAL = "__manter__";

const DeactivateProfessionalModal = ({
  professional,
  receivers,
  onClose,
  onDone,
}: DeactivateModalProps) => {
  const [summary, setSummary] = useState<PendingSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [receiverId, setReceiverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setLoadingSummary(true);
      setError(null);

      const { data, error } = await supabase.rpc("professional_pending_summary", {
        p_professional_id: professional.id,
      });

      if (!active) return;

      if (error) {
        setError(`Não foi possível verificar as pendências: ${friendlyError(error.message)}`);
        setLoadingSummary(false);
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as PendingSummary | null;
      setSummary(
        row ?? { future_appointments: 0, responsible_patients: 0, active_packages: 0 },
      );
      setLoadingSummary(false);
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, [professional.id]);

  const hasPending =
    !!summary &&
    summary.future_appointments + summary.responsible_patients + summary.active_packages > 0;

  const mustChooseReceiver = hasPending && !receiverId;
  const canSubmit = !loadingSummary && !!summary && !mustChooseReceiver && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const reassignTo =
      hasPending && receiverId !== KEEP_WITH_PROFESSIONAL ? receiverId : null;

    const { data, error } = await supabase.rpc("deactivate_professional", {
      p_professional_id: professional.id,
      p_reassign_to: reassignTo,
    });

    if (error) {
      setError(`Não foi possível inativar: ${friendlyError(error.message)}`);
      setSubmitting(false);
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as DeactivationResult | null;
    const receiverName = reassignTo
      ? receivers.find((item) => item.id === reassignTo)?.full_name ?? null
      : null;

    onDone(
      professional,
      row ?? { moved_appointments: 0, moved_patients: 0, moved_packages: 0 },
      receiverName,
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-lg">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Inativar {professional.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ela perde o acesso ao sistema na hora. Atendimentos já realizados,
              evoluções e comissões continuam no histórico com o nome dela.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loadingSummary ? (
            <p className="text-sm text-slate-500">Verificando pendências...</p>
          ) : summary && !hasPending ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Nenhum agendamento futuro, paciente ou pacote ativo está com ela.
            </div>
          ) : summary ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <p className="font-semibold">Ainda estão com ela:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {summary.future_appointments > 0 && (
                    <li>{plural(summary.future_appointments, "agendamento futuro", "agendamentos futuros")}</li>
                  )}
                  {summary.responsible_patients > 0 && (
                    <li>{plural(summary.responsible_patients, "paciente sob responsabilidade", "pacientes sob responsabilidade")}</li>
                  )}
                  {summary.active_packages > 0 && (
                    <li>{plural(summary.active_packages, "pacote ativo", "pacotes ativos")}</li>
                  )}
                </ul>
              </div>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Transferir para
                <select
                  value={receiverId}
                  onChange={(event) => setReceiverId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="">Escolha uma opção...</option>
                  {receivers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name} ({roleLabel(item.role)})
                    </option>
                  ))}
                  <option value={KEEP_WITH_PROFESSIONAL}>
                    Não transferir (continuam no nome dela)
                  </option>
                </select>
              </label>

              {receiverId === KEEP_WITH_PROFESSIONAL && (
                <p className="text-xs text-slate-500">
                  Os itens ficam no nome dela e precisam ser redistribuídos
                  manualmente pela agenda e pelo cadastro dos pacientes.
                </p>
              )}
            </>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              className="gap-2"
              onClick={handleSubmit}
              disabled={!canSubmit}
              isLoading={submitting}
            >
              {!submitting && <UserX size={16} />} Inativar acesso
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  );
};

type CommissionModalProps = {
  professional: TeamProfile;
  rules: CommissionRule[];
  onClose: () => void;
  onSaved: (rule: CommissionRule) => void;
};

function formatValidFrom(value: string): string {
  const date = new Date(value);
  if (date.getFullYear() <= 1900) return "desde o início";
  return `desde ${date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const CommissionModal = ({ professional, rules, onClose, onSaved }: CommissionModalProps) => {
  const current = currentCommissionRule(rules, professional.id);
  const [draft, setDraft] = useState<CommissionDraft>(draftFromRule(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = [...rules].sort(
    (a, b) =>
      new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime() ||
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );

  const unchanged =
    !!current &&
    current.commission_type === draft.type &&
    Number(current.commission_value) === parseCommissionValue(draft.value);

  const handleSave = async () => {
    const validation = commissionDraftError(draft);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error } = await supabase.rpc("set_professional_commission", {
      p_professional_id: professional.id,
      p_type: draft.type,
      p_value: parseCommissionValue(draft.value),
    });

    if (error) {
      setError(`Não foi possível alterar a comissão: ${friendlyError(error.message)}`);
      setSaving(false);
      return;
    }

    const rule = (Array.isArray(data) ? data[0] : data) as CommissionRule | null;
    if (!rule) {
      setError("A comissão foi enviada, mas o banco não confirmou a alteração. Recarregue a página e confira.");
      setSaving(false);
      return;
    }

    onSaved(rule);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Comissão de {professional.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Atual: <span className="font-semibold">{formatCommission(current)}</span>
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <CommissionFields idPrefix="professional" value={draft} onChange={setDraft} disabled={saving} />

          <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
            A nova comissão vale para as aulas a partir de agora. Aulas anteriores
            continuam com a comissão antiga, e aulas com valor de comissão já
            gravado mantêm o valor gravado.
          </p>

          {history.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Histórico</p>
              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                {history.map((rule, index) => (
                  <li key={rule.id ?? `${rule.valid_from}-${index}`} className="flex justify-between gap-3">
                    <span className={index === 0 ? "font-semibold" : ""}>{formatCommission(rule)}</span>
                    <span className="text-xs text-slate-400">{formatValidFrom(rule.valid_from)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} isLoading={saving} disabled={unchanged}>
              Salvar comissão
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  );
};
