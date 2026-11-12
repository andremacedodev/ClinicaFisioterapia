import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/authErrors";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Activity, ArrowRight, Building, Lock, Mail, User } from "lucide-react";

type RegisterMode = "clinic" | "invite";

export const Register = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<RegisterMode>(
    searchParams.get("convite") !== null ? "invite" : "clinic",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const isInvite = mode === "invite";

  const fail = (message: string) => {
    setError(message);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const normalizedEmail = email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          // Guardado na conta para a tela de configuração inicial, caso o
          // e-mail precise ser confirmado antes de entrar.
          ...(isInvite ? {} : { clinic_name: clinicName }),
        },
      },
    });

    if (authError) {
      fail(translateAuthError(authError.message));
      return;
    }

    if (!authData.session) {
      setInfo(
        isInvite
          ? "Conta criada! Abra o link que enviamos para o seu e-mail para confirmar. Depois entre com seu e-mail e senha e clique em \"Aceitar convite\"."
          : "Conta criada! Abra o link que enviamos para o seu e-mail para confirmar. Depois entre com seu e-mail e senha para terminar o cadastro da clínica.",
      );
      setLoading(false);
      return;
    }

    if (!authData.user) {
      fail("Não foi possível concluir o cadastro. Tente entrar pelo login.");
      return;
    }

    // Convite pendente para este e-mail: nunca criar clínica nova. A tela
    // inicial mostra "Aceitar convite".
    const { data: invitations, error: invitationError } = await supabase
      .from("professional_invitations")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .limit(1);

    if (invitationError) {
      fail(
        `Sua conta foi criada, mas não foi possível verificar se existe convite: ${invitationError.message}. Entre pelo login para continuar.`,
      );
      return;
    }

    if (invitations && invitations.length > 0) {
      navigate("/");
      return;
    }

    if (isInvite) {
      await supabase.auth.signOut();
      fail(
        `Sua conta foi criada, mas não encontramos convite para ${normalizedEmail}. Peça para a clínica conferir se o convite foi feito para este e-mail exato e depois entre pelo login.`,
      );
      return;
    }

    const { data: clinicData, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: clinicName,
        slug: clinicName.toLowerCase().replace(/\s+/g, "-"),
        owner_id: authData.user.id,
      })
      .select()
      .single();

    if (clinicError) {
      fail(`Erro ao criar a clínica: ${clinicError.message}`);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      clinic_id: clinicData.id,
      full_name: fullName,
      role: "admin",
    });

    if (profileError) {
      fail(`Erro ao criar o seu perfil: ${profileError.message}`);
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl text-white shadow-xl shadow-brand-200 dark:shadow-none mb-4">
            <Activity size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Crie sua conta</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isInvite
              ? "Use o mesmo e-mail em que a clínica fez o seu convite."
              : "Transforme a gestão da sua clínica hoje."}
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            {info && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm text-center">
                {info}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de cadastro">
              {([
                ["clinic", "Vou cadastrar minha clínica", "Sou dona ou administradora"],
                ["invite", "Recebi um convite", "Vou trabalhar numa clínica"],
              ] as const).map(([value, title, hint]) => {
                const selected = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={loading}
                    onClick={() => {
                      setMode(value);
                      setError(null);
                      setInfo(null);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs opacity-80">{hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Seu Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="Dra. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {!isInvite && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome da Clínica / Estúdio</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="Fisio & Pilates Studio"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
            </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isInvite ? "E-mail do convite" : "Email Profissional"}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="contato@clinica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 gap-2 mt-2" isLoading={loading}>
              Criar minha conta <ArrowRight size={18} />
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-brand-600 font-semibold hover:underline">
                Fazer login
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
