import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Lock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/authErrors";

type Stage = "checking" | "ready" | "invalid" | "done";

// Lê erros que o Supabase devolve na URL (ex.: link expirado).
function linkErrorFromUrl(): string | null {
  const params = new URLSearchParams(
    window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, ""),
  );
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  if (code === "otp_expired") return "Este link expirou. Peça um link novo.";
  return translateAuthError(params.get("error_description") ?? code);
}

/** Página aberta pelo link do e-mail: cria a senha nova. */
export const ResetPassword = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(() => linkErrorFromUrl());

  useEffect(() => {
    if (error) {
      setStage("invalid");
      return;
    }

    let resolved = false;
    const markReady = () => {
      resolved = true;
      setStage("ready");
    };

    // O cliente do Supabase lê o link e cria a sessão de recuperação.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) markReady();
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (resolved) return;
      if (sessionError) {
        setError(translateAuthError(sessionError.message));
        setStage("invalid");
      } else if (data.session) {
        markReady();
      }
    });

    // Sem sessão depois de alguns segundos: a página foi aberta sem o link.
    const timeout = window.setTimeout(() => {
      if (!resolved) setStage((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      subscription.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As duas senhas não são iguais. Digite de novo.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }
    setStage("done");
  };

  const inputClass =
    "w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl text-white shadow-xl shadow-brand-200 dark:shadow-none mb-4">
            {stage === "done" ? <CheckCircle2 size={32} /> : <KeyRound size={32} />}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {stage === "done" ? "Senha alterada" : "Criar senha nova"}
          </h1>
        </div>

        <Card className="p-8">
          {stage === "checking" && (
            <p className="text-center text-sm text-slate-500">Conferindo o link...</p>
          )}

          {stage === "invalid" && (
            <div className="space-y-5 text-center">
              <p role="alert" className="text-sm text-rose-600">
                {error ?? "Abra esta página pelo link que enviamos para o seu e-mail."}
              </p>
              <Button type="button" className="w-full" onClick={() => navigate("/recuperar-senha")}>
                Pedir um link novo
              </Button>
              <Link to="/login" className="block text-sm font-semibold text-brand-600 hover:underline">
                Voltar para o login
              </Link>
            </div>
          )}

          {stage === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 text-sm text-center"
                >
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha nova
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputClass}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Repita a senha nova
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    className={inputClass}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12" isLoading={saving}>
                Salvar senha nova
              </Button>
            </form>
          )}

          {stage === "done" && (
            <div className="space-y-5 text-center text-sm text-slate-600 dark:text-slate-300">
              <p>Pronto! A partir de agora, use a senha nova para entrar.</p>
              <Button type="button" className="w-full" onClick={() => navigate("/")}>
                Entrar no sistema
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
