import { FinancialCard, formatDate, getDefaultCommissionPeriod, useFinancial } from "./financialCore";
import { AlertTriangle, ArrowDownCircle, DollarSign, TrendingUp, UserCheck } from "lucide-react";

export const FinancialOverview = () => {
  const {
    isPhysio,
    totals,
  } = useFinancial();

  return (
    <>
      <div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Indicadores do mês atual: {formatDate(getDefaultCommissionPeriod().startDate)} a {formatDate(getDefaultCommissionPeriod().endDate)}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
        {!isPhysio && (
          <>
            <FinancialCard
              label="Receita vendida"
              value={totals.sold}
              icon={TrendingUp}
            />
            <FinancialCard
              label="Valor recebido"
              value={totals.paid}
              icon={DollarSign}
            />
            <FinancialCard
              label="Total em aberto"
              value={totals.open}
              icon={AlertTriangle}
              danger
            />
            <FinancialCard
              label="Despesas pagas"
              value={totals.paidExpenses}
              icon={ArrowDownCircle}
              danger
            />
            <FinancialCard
              label="Resultado líquido"
              value={totals.net}
              icon={DollarSign}
              danger={totals.net < 0}
            />
          </>
        )}
        <FinancialCard
          label={isPhysio ? "A receber" : "Comissão a pagar"}
          value={totals.professionalShare}
          icon={UserCheck}
        />
        </div>
      </div>
    </>
  );
};
