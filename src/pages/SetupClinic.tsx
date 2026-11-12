import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building, User } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FisioOneMark } from "../components/brand/FisioOneLogo";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `clinica-${Date.now()}`;
}

export const SetupClinic = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const defaultName = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name;
    return typeof metadataName === "string" ? metadataName : "";
  }, [user?.user_metadata?.full_name]);

  const [fullName, setFullName] = useState(defaultName);
  // Nome da clínica digitado no cadastro (fica guardado na conta quando o
  // e-mail precisa ser confirmado antes de entrar).
  const [clinicName, setClinicName] = useState(() => {
    const metadataClinic = user?.user_metadata?.clinic_name;
    return typeof metadataClinic === "string" ? metadataClinic : "";
  });
  const [inviteLookupError, setInviteLookupError] = useState<string | null>(null);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [invitation, setInvitation] = useState<{
    id: string;
    clinic_id: string;
    full_name: string;
    role: "physio" | "receptionist";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      if (!user?.email) {
        setCheckingInvite(false);
        return;
      }

      setCheckingInvite(true);
      setInviteLookupError(null);

      // Mais de um convite pendente (ex.: duas clínicas): usa o mais recente.
      const { data, error } = await supabase
        .from("professional_invitations")
        .select("id, clinic_id, full_name, role")
        .eq("email", user.email.toLowerCase())
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!active) return;

      if (error) {
        // Não oferecer "criar clínica" se não deu para conferir o convite:
        // a fisioterapeuta convidada acabaria criando uma clínica nova.
        setInviteLookupError(`Não foi possível verificar se existe convite para você: ${error.message}`);
      } else if (data && data.length > 0) {
        const found = data[0] as NonNullable<typeof invitation>;
        setInvitation(found);
        setFullName(found.full_name);
      }

      setCheckingInvite(false);
    }

    checkInvitation();

    return () => {
      active = false;
    };
  }, [user?.email, lookupAttempt]);

  const acceptInvitation = async () => {
    if (!user || !invitation) return;

    setLoading(true);
    setError(null);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      clinic_id: invitation.clinic_id,
      full_name: fullName.trim() || invitation.full_name,
      role: invitation.role,
    });

    if (profileError) {
      setError(`Erro ao aceitar convite: ${profileError.message}`);
      setLoading(false);
      return;
    }

    const { error: invitationError } = await supabase
      .from("professional_invitations")
      .update({
        status: "accepted",
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (invitationError) {
      console.warn("Invitation was accepted but not updated:", invitationError);
    }

    await refreshProfile();
    setLoading(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setError("Sessão não encontrada. Faça login novamente.");
      return;
    }

    setLoading(true);
    setError(null);

    const baseSlug = slugify(clinicName);
    const insertClinic = (slug: string) =>
      supabase
        .from("clinics")
        .insert({
          name: clinicName.trim(),
          slug,
          owner_id: user.id,
        })
        .select("id")
        .single();

    // Outra clínica pode já usar o mesmo nome: tenta de novo com sufixo.
    let { data: clinic, error: clinicError } = await insertClinic(baseSlug);
    for (let attempt = 0; clinicError?.code === "23505" && attempt < 3; attempt++) {
      const suffix = Math.random().toString(36).slice(2, 6);
      ({ data: clinic, error: clinicError } = await insertClinic(
        `${baseSlug}-${suffix}`,
      ));
    }

    if (clinicError || !clinic) {
      setError(`Erro ao criar clínica: ${clinicError?.message ?? "tente novamente."}`);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      clinic_id: clinic.id,
      full_name: fullName.trim() || user.email || "Administrador",
      role: "admin",
    });

    if (profileError) {
      setError(`Erro ao criar administrador: ${profileError.message}`);
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <FisioOneMark size={64} title="FisioOne" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {inviteLookupError
              ? "Não foi possível continuar"
              : invitation
                ? "Aceitar convite"
                : "Configurar administrador"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {checkingInvite
              ? "Verificando se existe convite para este usuário."
              : inviteLookupError
                ? "Confira a internet e tente de novo."
                : invitation
                ? "Você foi convidada para acessar a clínica como fisioterapeuta."
                : "Falta só cadastrar a sua clínica para começar a usar o sistema."}
          </p>
        </div>

        <Card className="p-8">
          {checkingInvite ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Verificando convite...
            </div>
          ) : inviteLookupError ? (
            <div className="space-y-4">
              <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 text-sm text-center">
                {inviteLookupError}
              </div>
              <Button type="button" className="w-full" onClick={() => setLookupAttempt((n) => n + 1)}>
                Tentar de novo
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={signOut}>
                Sair
              </Button>
            </div>
          ) : invitation ? (
            <div className="space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 text-sm text-center">
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Convite encontrado para{" "}
                <span className="font-semibold">{user?.email}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nome da profissional
                </label>
                <input
                  required
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-60"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>

              <Button
                type="button"
                className="w-full h-12 gap-2"
                isLoading={loading}
                onClick={acceptInvitation}
              >
                Entrar como fisioterapeuta <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Usuário autenticado:{" "}
              <span className="font-semibold">{user?.email}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nome do administrador
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-60"
                  placeholder="Dra. Nome Sobrenome"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nome da clínica / estúdio
              </label>
              <div className="relative">
                <Building
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-60"
                  placeholder="Clínica Equilíbrio Pilates"
                  value={clinicName}
                  onChange={(event) => setClinicName(event.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 gap-2"
              isLoading={loading}
            >
              Criar clínica e perfil admin <ArrowRight size={18} />
            </Button>
          </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
              onClick={signOut}
            >
              Sair e usar outro login
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
