import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { currencyFormatter, useFinancial } from "./financialCore";
import { clsx } from "clsx";
import { Button } from "../../components/ui/Button";
import { Check } from "lucide-react";

export const FinancialCommissions = () => {
  const {
    setCommissionTarget,
    patientSearchTerm,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    isPhysio,
    isAdmin,
    hasPatientSearch,
    commissionPeriodLabel,
    downloadCommissionReportExcel,
    downloadAdminProductionExcel,
    commissionReport,
  } = useFinancial();

  return (
    <>
      <div>
        <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Comissão por fisioterapeuta
              </h3>
              <p className="text-sm text-slate-500">
                {commissionPeriodLabel}
              </p>
              {hasPatientSearch && (
                <p className="text-sm text-slate-500">
                  Produção filtrada pelo paciente "{patientSearchTerm}".
                </p>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={downloadCommissionReportExcel}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Exportar EXCEL
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Fisioterapeuta</th>
                <th className="px-6 py-4">Aulas</th>
                <th className="px-6 py-4">Faltas pagas</th>
                <th className="px-6 py-4">Bruto</th>
                <th className="px-6 py-4">Já pago</th>
                <th className="px-6 py-4">A pagar</th>
                {!isPhysio && <th className="px-6 py-4">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {commissionReport.length === 0 ? (
                <tr>
                  <td
                    colSpan={isPhysio ? 6 : 7}
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    Nenhuma sessão não cancelada encontrada neste período.
                  </td>
                </tr>
              ) : (
                commissionReport.map((item) => (
                  <tr key={item.professionalId}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.professionalName}
                      </p>
                      <Badge variant="neutral">Produção</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {item.heldClasses}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {item.paidMisses}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {currencyFormatter.format(item.gross)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {currencyFormatter.format(item.commissionPaid)}
                    </td>
                    <td
                      className={clsx(
                        "px-6 py-4 text-sm font-bold",
                        item.professionalShare > 0
                          ? "text-emerald-600"
                          : "text-slate-500",
                      )}
                    >
                      {currencyFormatter.format(item.professionalShare)}
                    </td>
                    {!isPhysio && (
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={item.professionalShare <= 0}
                          onClick={() => setCommissionTarget(item)}
                        >
                          <Check size={14} />
                          Registrar pagamento
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
      {isAdmin && (
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Produção da fisioterapeuta administradora
              </h3>
              <p className="text-sm text-slate-500">
                Planilha exclusiva da ADM, sem comissão a pagar para estas aulas.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={downloadAdminProductionExcel}
            >
              Exportar planilha ADM
            </Button>
          </div>
        </Card>
      )}
    </>
  );
};
