import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type ClinicSettingsRow = {
  id: string;
  name: string;
  owner_id: string | null;
  nfeio_company_id: string | null;
};

const inputClassName =
  "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none";

export const ClinicSettings = () => {
  const { profile, user } = useAuth();
  const [clinic, setClinic] = useState<ClinicSettingsRow | null>(null);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [registry, setRegistry] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingRegistry, setSavingRegistry] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const isOwner = Boolean(clinic && user && clinic.owner_id === user.id);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [clinicResult, profileResult] = await Promise.all([
        supabase
          .from("clinics")
          .select("id, name, owner_id, nfeio_company_id")
          .eq("id", profile.clinic_id)
          .single(),
        supabase
          .from("profiles")
          .select("professional_registry")
          .eq("id", profile.id)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (clinicResult.error) {
        setError(
          clinicResult.error.message.includes("nfeio_company_id")
            ? "O banco ainda não tem a coluna nfeio_company_id. Rode a migration mais recente no Supabase."
            : clinicResult.error.message,
        );
        setLoading(false);
        return;
      }

      const loadedClinic = clinicResult.data as ClinicSettingsRow;
      setClinic(loadedClinic);
      setName(loadedClinic.name);
      setCompanyId(loadedClinic.nfeio_company_id ?? "");
      setRegistry(
        (profileResult.data as { professional_registry?: string | null } | null)
          ?.professional_registry ?? "",
      );
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [profile?.clinic_id, profile?.id]);

  const copyClinicId = async () => {
    if (!clinic) return;
    try {
      await navigator.clipboard.writeText(clinic.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Não foi possível copiar. Selecione o ID e copie manualmente.");
    }
  };

  const saveClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinic) return;

    const trimmedCompanyId = companyId.trim();
    if (trimmedCompanyId.toLowerCase().startsWith("acc_")) {
      setError(
        "Esse é o AccountId da NFe.io. Use o ID da empresa (Company.Id), que não começa com acc_.",
      );
      return;
    }

    setSavingClinic(true);
    setError(null);
    setNotice(null);

    const { data, error: updateError } = await supabase
      .from("clinics")
      .update({
        name: name.trim() || clinic.name,
        nfeio_company_id: trimmedCompanyId || null,
      })
      .eq("id", clinic.id)
      .select("id, name, owner_id, nfeio_company_id");

    setSavingClinic(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Sem erro e sem linha retornada = a RLS barrou (só a dona pode editar).
    const updated = data?.[0] as ClinicSettingsRow | undefined;
    if (!updated) {
      setError("Somente a pessoa que criou a clínica pode alterar estes dados.");
      return;
    }

    setClinic(updated);
    setNotice("Dados da clínica salvos.");
  };

  const saveRegistry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setSavingRegistry(true);
    setError(null);
    setNotice(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ professional_registry: registry.trim() || null })
      .eq("id", profile.id);

    setSavingRegistry(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice("Registro profissional salvo.");
  };

  if (!isAdmin) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Acesso restrito
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Apenas administradores podem alterar as configurações da clínica.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Configurações
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Dados da clínica e integração com a emissão de notas fiscais.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando configurações...</p>
      ) : (
        clinic && (
          <>
            <Card title="Clínica">
              <form onSubmit={saveClinic} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    ID da clínica
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      className={`${inputClassName} font-mono text-sm text-slate-600`}
                      value={clinic.id}
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 shrink-0"
                      onClick={copyClinicId}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Identificador interno do sistema. Não precisa ser alterado.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nome da clínica
                  </label>
                  <input
                    required
                    disabled={!isOwner}
                    className={inputClassName}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Aparece nos atestados e recibos.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    ID da empresa na NFe.io (Company.Id)
                  </label>
                  <input
                    disabled={!isOwner}
                    className={`${inputClassName} font-mono text-sm`}
                    placeholder="Ex.: 5f1a2b3c4d5e6f7a8b9c0d1e"
                    value={companyId}
                    onChange={(event) => setCompanyId(event.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    No painel da NFe.io, abra <strong>Empresas</strong>, entre
                    na empresa da clínica e copie o <strong>ID</strong>. Não use
                    o AccountId (que começa com <code>acc_</code>). Sem esse
                    campo a clínica não emite NFS-e.{" "}
                    <a
                      href="https://app.nfe.io"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      Abrir NFe.io <ExternalLink size={12} />
                    </a>
                  </p>
                </div>

                {isOwner ? (
                  <Button type="submit" isLoading={savingClinic}>
                    Salvar dados da clínica
                  </Button>
                ) : (
                  <p className="text-sm text-amber-700">
                    Somente a pessoa que criou a clínica pode alterar estes
                    dados.
                  </p>
                )}
              </form>
            </Card>

            <Card title="Meu registro profissional">
              <form
                onSubmit={saveRegistry}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start"
              >
                <div className="space-y-2">
                  <input
                    className={inputClassName}
                    placeholder="Ex.: CREFITO 12345-F/MT"
                    value={registry}
                    onChange={(event) => setRegistry(event.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Preenchido automaticamente nos atestados que você emitir.
                  </p>
                </div>
                <Button type="submit" variant="outline" isLoading={savingRegistry}>
                  Salvar registro
                </Button>
              </form>
            </Card>
          </>
        )
      )}
    </div>
  );
};
