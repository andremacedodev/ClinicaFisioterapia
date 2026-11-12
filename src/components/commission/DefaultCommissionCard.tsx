import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { supabase } from "../../lib/supabase";
import { formatCommission } from "../../lib/commissionRules";
import {
  CommissionDraft,
  CommissionFields,
  commissionDraftError,
  draftFromRule,
  parseCommissionValue,
} from "./CommissionFields";

type Props = { clinicId: string };

/** Comissão padrão da clínica (Configurações). Vale para quem entrar depois. */
export const DefaultCommissionCard = ({ clinicId }: Props) => {
  const [draft, setDraft] = useState<CommissionDraft>(draftFromRule(null));
  const [saved, setSaved] = useState<{ commission_type: string; commission_value: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("clinics")
        .select("default_commission_type, default_commission_value")
        .eq("id", clinicId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setError(
          /default_commission/.test(error.message)
            ? "O banco ainda não recebeu a atualização de comissão configurável (migration 20261112000000_configurable_commission.sql)."
            : `Erro ao carregar a comissão padrão: ${error.message}`,
        );
      } else if (data) {
        const row = data as { default_commission_type: string; default_commission_value: number };
        const rule = {
          commission_type: row.default_commission_type,
          commission_value: Number(row.default_commission_value),
        };
        setSaved(rule);
        setDraft(draftFromRule(rule));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const handleSave = async () => {
    const validation = commissionDraftError(draft);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    const value = parseCommissionValue(draft.value);
    const { error } = await supabase.rpc("set_clinic_default_commission", {
      p_type: draft.type,
      p_value: value,
    });
    setSaving(false);

    if (error) {
      setError(`Não foi possível salvar: ${error.message}`);
      return;
    }

    const rule = { commission_type: draft.type, commission_value: value };
    setSaved(rule);
    setNotice(`Comissão padrão salva: ${formatCommission(rule)}.`);
  };

  return (
    <Card
      title="Comissão padrão"
      subtitle="Sugerida no convite de novas fisioterapeutas. Para mudar a comissão de quem já está na equipe, use a tela Equipe."
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <CommissionFields idPrefix="default" value={draft} onChange={setDraft} disabled={saving} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {saved ? `Atual: ${formatCommission(saved)}` : ""}
              </p>
              <Button type="button" onClick={handleSave} isLoading={saving}>
                Salvar comissão padrão
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
