import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { FinancialCard, currencyFormatter, formatDate, getDefaultCommissionPeriod, useFinancial } from "./financialCore";
import { AlertTriangle, ArrowDownCircle, CreditCard, DollarSign, TrendingUp, UserCheck } from "lucide-react";

export const FinancialOverview = () => {
  const {
    isPhysio,
    totals,
    overdueCardReceivables,
    legacyCardPackages,
    setReceivableFilter,
  } = useFinancial();
  const navigate = useNavigate();
  const showCardAlert =
    !isPhysio && (overdueCardReceivables.count > 0 || legacyCardPackages.length > 0);

  return (
    <>
      {showCardAlert && (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          <div className="flex items-start gap-3">
            <CreditCard size={20} className="mt-0.5 shrink-0 text-sky-600" />
            <div className="space-y-0.5">
              {overdueCardReceivables.count > 0 && (
                <p>
                  <strong>
                    {overdueCardReceivables.count}{" "}
                    {overdueCardReceivables.count === 1 ? "parcela do cartão já deveria ter caído" : "parcelas do cartão já deveriam ter caído"}
                  </strong>{" "}
                  ({currencyFormatter.format(overdueCardReceivables.amount)}). Confira no extrato da maquininha e confirme.
                </p>
              )}
              {legacyCardPackages.length > 0 && (
                <p>
                  {legacyCardPackages.length}{" "}
                  {legacyCardPackages.length === 1 ? "pacote pago no cartão está" : "pacotes pagos no cartão estão"} com
                  parcelas em aberto como se o paciente devesse.
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              if (overdueCardReceivables.count > 0) setReceivableFilter("card");
              navigate("/financeiro/recebimentos");
            }}
          >
            Ver em Recebimentos
          </Button>
        </div>
      )}
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
