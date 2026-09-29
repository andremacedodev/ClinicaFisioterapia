import { ReactNode, useEffect, useRef } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { FinancialCommissions } from "./Comissoes";
import { FinancialExpenses } from "./Despesas";
import { FinancialStatement } from "./Extrato";
import { FinancialModals } from "./FinancialModals";
import { FinancialToolbar } from "./FinancialToolbar";
import { FinancialReceivables } from "./Recebimentos";
import { FinancialOverview } from "./VisaoGeral";
import { FinancialProvider, useFinancial } from "./financialCore";

const TABS = [
  { to: "/financeiro", label: "Visão geral", end: true },
  { to: "/financeiro/recebimentos", label: "Recebimentos" },
  { to: "/financeiro/despesas", label: "Despesas" },
  { to: "/financeiro/comissoes", label: "Comissões" },
  { to: "/financeiro/extrato", label: "Extrato" },
];

const FinancialTabs = () => {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // No celular as abas rolam na horizontal: mantém a aba ativa à vista.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const navLeft = nav.getBoundingClientRect().left;
    const activeLeft = active.getBoundingClientRect().left;
    const offset =
      nav.scrollLeft + activeLeft - navLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(offset, 0) });
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Seções do financeiro"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex w-max gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              clsx(
                "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

const FinancialLayout = () => {
  const { isPhysio, error, loading, setExpenseFormOpen } = useFinancial();
  const location = useLocation();
  const navigate = useNavigate();
  const focusExpenseForm = Boolean(
    (location.state as { focusExpenseForm?: boolean } | null)?.focusExpenseForm,
  );

  // "Lançar despesa" leva para a aba Despesas com a janela de nova despesa aberta.
  useEffect(() => {
    if (loading || !focusExpenseForm) return;
    setExpenseFormOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [focusExpenseForm, loading, location.pathname, navigate, setExpenseFormOpen]);

  return (
    <div className="space-y-5 sm:space-y-8 animate-in fade-in duration-500">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Financeiro
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            {isPhysio
              ? "Acompanhe sua produção financeira pelas aulas realizadas e faltas pagas."
              : "Registre parcelas, acompanhe histórico de pacotes e cobre pelo WhatsApp."}
          </p>
        </div>
        {!isPhysio && <FinancialTabs />}
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p>Carregando financeiro...</p>
        </div>
      ) : (
        <>
          <FinancialToolbar />
          <Outlet />
        </>
      )}

      <FinancialModals />
    </div>
  );
};

// Abas só da equipe administrativa; fisioterapeutas veem apenas a própria produção.
const StaffOnly = ({ children }: { children: ReactNode }) => {
  const { isPhysio } = useFinancial();
  return isPhysio ? <Navigate to="/financeiro" replace /> : <>{children}</>;
};

const FinancialHome = () => {
  const { isPhysio } = useFinancial();
  if (!isPhysio) return <FinancialOverview />;

  return (
    <>
      <FinancialOverview />
      <FinancialCommissions />
    </>
  );
};

export const Financial = () => (
  <FinancialProvider>
    <Routes>
      <Route element={<FinancialLayout />}>
        <Route index element={<FinancialHome />} />
        <Route
          path="recebimentos"
          element={
            <StaffOnly>
              <FinancialReceivables />
            </StaffOnly>
          }
        />
        <Route
          path="despesas"
          element={
            <StaffOnly>
              <FinancialExpenses />
            </StaffOnly>
          }
        />
        <Route
          path="comissoes"
          element={
            <StaffOnly>
              <FinancialCommissions />
            </StaffOnly>
          }
        />
        <Route
          path="extrato"
          element={
            <StaffOnly>
              <FinancialStatement />
            </StaffOnly>
          }
        />
        <Route path="*" element={<Navigate to="/financeiro" replace />} />
      </Route>
    </Routes>
  </FinancialProvider>
);
