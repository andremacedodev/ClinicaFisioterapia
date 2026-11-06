import { useState } from "react";
import { LogOut, UserX } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";

// Mostrada quando o perfil existe mas foi inativado pela administradora.
// O banco já bloqueia todos os dados da clínica para esse usuário; esta tela
// só explica o motivo em vez de exibir páginas vazias.
export const InactiveAccess = () => {
  const { profile, user, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const handleSignOut = async () => {
    setLeaving(true);
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 mb-4">
            <UserX size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Acesso desativado
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {profile?.full_name ? `${profile.full_name}, seu` : "Seu"} acesso a
            esta clínica foi desativado pela administração.
          </p>
        </div>

        <Card className="p-8">
          <div className="space-y-5 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Se você acredita que isso é um engano, fale com a administradora
              da clínica para reativar o seu acesso.
            </p>
            {user?.email && (
              <p className="text-xs text-slate-500">
                Conectado como <span className="font-semibold">{user.email}</span>
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              isLoading={leaving}
              onClick={handleSignOut}
            >
              <LogOut size={18} /> Sair
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
