import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import {
  CLINIC_ASSETS_BUCKET,
  ClinicProfile,
  clinicLogoUrl,
  fetchClinicProfile,
  formatCep,
  formatCnpj,
  formatPhone,
  onlyDigits,
} from "../lib/clinicProfile";
import { supabase } from "../lib/supabase";

type ClinicForm = {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_district: string;
  address_city: string;
  address_state: string;
  nfeio_company_id: string;
};

const EMPTY_FORM: ClinicForm = {
  name: "",
  cnpj: "",
  phone: "",
  email: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_district: "",
  address_city: "",
  address_state: "",
  nfeio_company_id: "",
};

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const inputClassName =
  "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60";
const labelClassName = "text-sm font-medium text-slate-700 dark:text-slate-300";

const MISSING_COLUMNS_MESSAGE =
  "O banco ainda não tem os campos novos da clínica. Rode a migration mais recente no Supabase.";

function isMissingColumnError(error: { code?: string; message: string }) {
  return error.code === "42703" || /column .* does not exist|schema cache/i.test(error.message);
}

function toForm(clinic: ClinicProfile, companyId: string | null): ClinicForm {
  return {
    name: clinic.name,
    cnpj: formatCnpj(clinic.cnpj),
    phone: formatPhone(clinic.phone),
    email: clinic.email ?? "",
    address_zip: formatCep(clinic.address_zip),
    address_street: clinic.address_street ?? "",
    address_number: clinic.address_number ?? "",
    address_complement: clinic.address_complement ?? "",
    address_district: clinic.address_district ?? "",
    address_city: clinic.address_city ?? "",
    address_state: clinic.address_state ?? "",
    nfeio_company_id: companyId ?? "",
  };
}

const orNull = (value: string) => value.trim() || null;

export const ClinicSettings = () => {
  const { profile, user } = useAuth();
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [form, setForm] = useState<ClinicForm>(EMPTY_FORM);
  const [registry, setRegistry] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingRegistry, setSavingRegistry] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === "admin";
  const isOwner = Boolean(clinic && user && clinic.owner_id === user.id);
  const logoUrl = clinicLogoUrl(clinic?.logo_path);

  const setField = (field: keyof ClinicForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  const setMaskedField =
    (field: keyof ClinicForm, mask: (value: string) => string) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: mask(event.target.value) }));

  useEffect(() => {
    if (!profile?.clinic_id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [loadedClinic, companyResult, profileResult] = await Promise.all([
          fetchClinicProfile(profile.clinic_id),
          supabase
            .from("clinics")
            .select("nfeio_company_id")
            .eq("id", profile.clinic_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("professional_registry")
            .eq("id", profile.id)
            .maybeSingle(),
        ]);
        if (!active) return;

        const companyId =
          (companyResult.data as { nfeio_company_id?: string | null } | null)
            ?.nfeio_company_id ?? null;

        setClinic(loadedClinic);
        setForm(toForm(loadedClinic, companyId));
        setRegistry(
          (profileResult.data as { professional_registry?: string | null } | null)
            ?.professional_registry ?? "",
        );
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (active) setLoading(false);
      }
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

  const updateClinic = async (changes: Record<string, unknown>) => {
    if (!clinic) return null;

    const { data, error: updateError } = await supabase
      .from("clinics")
      .update(changes)
      .eq("id", clinic.id)
      .select("id");

    if (updateError) {
      throw new Error(
        isMissingColumnError(updateError) ? MISSING_COLUMNS_MESSAGE : updateError.message,
      );
    }
    // Sem erro e sem linha retornada = a RLS barrou (só a dona pode editar).
    if (!data?.length) {
      throw new Error("Somente a pessoa que criou a clínica pode alterar estes dados.");
    }
    return fetchClinicProfile(clinic.id);
  };

  const saveClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinic) return;

    const cnpjDigits = onlyDigits(form.cnpj);
    if (cnpjDigits && cnpjDigits.length !== 14) {
      setError("O CNPJ precisa ter 14 números.");
      return;
    }
    const companyId = form.nfeio_company_id.trim();
    if (companyId.toLowerCase().startsWith("acc_")) {
      setError(
        "Esse é o AccountId da NFe.io. Use o ID da empresa (Company.Id), que não começa com acc_.",
      );
      return;
    }

    setSavingClinic(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateClinic({
        name: form.name.trim() || clinic.name,
        cnpj: cnpjDigits || null,
        phone: onlyDigits(form.phone) || null,
        email: orNull(form.email),
        address_zip: onlyDigits(form.address_zip) || null,
        address_street: orNull(form.address_street),
        address_number: orNull(form.address_number),
        address_complement: orNull(form.address_complement),
        address_district: orNull(form.address_district),
        address_city: orNull(form.address_city),
        address_state: orNull(form.address_state),
        nfeio_company_id: companyId || null,
      });
      if (updated) setClinic(updated);
      setNotice("Dados da clínica salvos.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingClinic(false);
    }
  };

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !clinic) return;

    const extension = LOGO_TYPES[file.type];
    if (!extension) {
      setError("Envie o logo em PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("O logo pode ter no máximo 2 MB.");
      return;
    }

    setSavingLogo(true);
    setError(null);
    setNotice(null);

    // Nome novo a cada envio: evita que o navegador mostre o logo antigo do cache.
    const path = `${clinic.id}/logo-${Date.now()}.${extension}`;
    const previousPath = clinic.logo_path;

    try {
      const { error: uploadError } = await supabase.storage
        .from(CLINIC_ASSETS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`Erro ao enviar o logo: ${uploadError.message}`);

      const updated = await updateClinic({ logo_path: path });
      if (updated) setClinic(updated);

      if (previousPath) {
        await supabase.storage.from(CLINIC_ASSETS_BUCKET).remove([previousPath]);
      }
      setNotice("Logo atualizado. Ele já aparece nos atestados e recibos.");
    } catch (uploadError) {
      await supabase.storage.from(CLINIC_ASSETS_BUCKET).remove([path]);
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setSavingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (!clinic?.logo_path) return;

    setSavingLogo(true);
    setError(null);
    setNotice(null);

    try {
      const previousPath = clinic.logo_path;
      const updated = await updateClinic({ logo_path: null });
      if (updated) setClinic(updated);
      await supabase.storage.from(CLINIC_ASSETS_BUCKET).remove([previousPath]);
      setNotice("Logo removido.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    } finally {
      setSavingLogo(false);
    }
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
          Dados da clínica que aparecem nos atestados, recibos e relatórios. Todos
          os campos são opcionais, exceto o nome.
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
            {!isOwner && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Somente a pessoa que criou a clínica pode alterar estes dados.
              </div>
            )}

            <Card title="Logo" subtitle="Aparece no topo dos atestados, recibos e relatórios.">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex h-28 w-full sm:w-56 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo da clínica"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-slate-400">Sem logo</span>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={uploadLogo}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={!isOwner}
                      isLoading={savingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImagePlus size={16} />
                      {logoUrl ? "Trocar logo" : "Enviar logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        disabled={!isOwner || savingLogo}
                        onClick={removeLogo}
                      >
                        <Trash2 size={16} /> Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    PNG, JPG ou WEBP, até 2 MB. Prefira imagem horizontal com
                    fundo transparente ou branco.
                  </p>
                </div>
              </div>
            </Card>

            <form onSubmit={saveClinic} className="space-y-8">
              <Card title="Dados da clínica">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClassName}>Nome da clínica</label>
                    <input
                      required
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.name}
                      onChange={setField("name")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClassName}>CNPJ</label>
                    <input
                      disabled={!isOwner}
                      inputMode="numeric"
                      className={inputClassName}
                      placeholder="00.000.000/0000-00"
                      value={form.cnpj}
                      onChange={setMaskedField("cnpj", formatCnpj)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClassName}>Telefone / WhatsApp</label>
                    <input
                      disabled={!isOwner}
                      inputMode="tel"
                      className={inputClassName}
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={setMaskedField("phone", formatPhone)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClassName}>E-mail</label>
                    <input
                      disabled={!isOwner}
                      type="email"
                      className={inputClassName}
                      placeholder="contato@suaclinica.com.br"
                      value={form.email}
                      onChange={setField("email")}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Endereço">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClassName}>CEP</label>
                    <input
                      disabled={!isOwner}
                      inputMode="numeric"
                      className={inputClassName}
                      placeholder="00000-000"
                      value={form.address_zip}
                      onChange={setMaskedField("address_zip", formatCep)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <label className={labelClassName}>Rua / Avenida</label>
                    <input
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.address_street}
                      onChange={setField("address_street")}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClassName}>Número</label>
                    <input
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.address_number}
                      onChange={setField("address_number")}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <label className={labelClassName}>Complemento</label>
                    <input
                      disabled={!isOwner}
                      className={inputClassName}
                      placeholder="Sala, bloco..."
                      value={form.address_complement}
                      onChange={setField("address_complement")}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClassName}>Bairro</label>
                    <input
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.address_district}
                      onChange={setField("address_district")}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className={labelClassName}>Cidade</label>
                    <input
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.address_city}
                      onChange={setField("address_city")}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className={labelClassName}>UF</label>
                    <select
                      disabled={!isOwner}
                      className={inputClassName}
                      value={form.address_state}
                      onChange={setField("address_state")}
                    >
                      <option value="">--</option>
                      {BRAZIL_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>

              <Card title="Integrações">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className={labelClassName}>ID da clínica</label>
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
                    <label className={labelClassName}>
                      ID da empresa na NFe.io (opcional)
                    </label>
                    <input
                      disabled={!isOwner}
                      className={`${inputClassName} font-mono text-sm`}
                      placeholder="Só se a clínica emitir NFS-e pela NFe.io"
                      value={form.nfeio_company_id}
                      onChange={setField("nfeio_company_id")}
                    />
                    <p className="text-xs text-slate-500">
                      Necessário apenas para emitir nota fiscal pelo sistema. No
                      painel da NFe.io, abra <strong>Empresas</strong> e copie o{" "}
                      <strong>ID</strong> da empresa (não o AccountId que começa
                      com <code>acc_</code>).{" "}
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
                </div>
              </Card>

              {isOwner && (
                <Button type="submit" isLoading={savingClinic}>
                  Salvar dados da clínica
                </Button>
              )}
            </form>

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
