import { FormEvent, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/authErrors";

/** Pede o link de redefinição de senha por e-mail. */
export const ForgotPassword = () => {
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const target = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setSentTo(target);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl text-white shadow-xl shadow-brand-200 dark:shadow-none mb-4">
            {sentTo ? <MailCheck size={32} /> : <KeyRound size={32} />}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {sentTo ? "Confira seu e-mail" : "Esqueceu a senha?"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {sentTo
              ? "Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova."
              : "Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova."}
          </p>
        </div>

        <Card className="p-8">
          {sentTo ? (
            <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Enviamos para <span className="font-semibold">{sentTo}</span>. Abra o e-mail e
                clique no link. Se não aparecer em alguns minutos, olhe também a caixa de
                <span className="font-semibold"> spam</span> ou <span className="font-semibold">lixo eletrônico</span>.
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={() => setSentTo(null)}>
                Enviar de novo ou usar outro e-mail
              </Button>
            </div>
          ) : (
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
                <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12" isLoading={loading}>
                Enviar link
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
              <ArrowLeft size={16} /> Voltar para o login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
