import { FileDown, PlusCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { useFinancial } from "./financialCore";

export const FinancialToolbar = () => {
  const navigate = useNavigate();
  const {
    patientSearchTerm,
    setPatientSearchTerm,
    setFinancialReportOpen,
    isPhysio,
    hasPatientSearch,
  } = useFinancial();

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Buscar paciente..."
          className="min-h-11 w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
          value={patientSearchTerm}
          onChange={(event) => setPatientSearchTerm(event.target.value)}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {hasPatientSearch && (
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => setPatientSearchTerm("")}
          >
            Limpar busca
          </Button>
        )}
        {!isPhysio && (
          <Button
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            onClick={() => setFinancialReportOpen(true)}
          >
            <FileDown size={16} />
            Exportar PDF
          </Button>
        )}
        {!isPhysio && (
          <Button
            className="w-full gap-2 sm:w-auto"
            onClick={() =>
              navigate("/financeiro/despesas", { state: { focusExpenseForm: true } })
            }
          >
            <PlusCircle size={16} />
            Lançar despesa
          </Button>
        )}
      </div>
    </div>
  );
};
