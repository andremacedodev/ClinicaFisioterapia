import {
  ClinicProfile,
  clinicLogoUrl,
  formatClinicAddress,
  formatCnpj,
  formatPhone,
} from '../../lib/clinicProfile';

// Versão em tela do cabeçalho impresso (clinicHeaderHtml).
export const ClinicHeader = ({ clinic }: { clinic: ClinicProfile | null }) => {
  const logoUrl = clinicLogoUrl(clinic?.logo_path);
  const contact = [clinic?.phone ? formatPhone(clinic.phone) : '', clinic?.email ?? '']
    .filter(Boolean)
    .join(' · ');
  const details = [
    clinic?.cnpj ? `CNPJ ${formatCnpj(clinic.cnpj)}` : '',
    formatClinicAddress(clinic),
    contact,
  ].filter(Boolean);

  return (
    <div className="flex min-w-0 items-center gap-4">
      {logoUrl && (
        <img src={logoUrl} alt="" className="max-h-14 max-w-[120px] shrink-0 object-contain" />
      )}
      <div className="min-w-0">
        <p className="text-xl font-bold">{clinic?.name ?? 'Clínica'}</p>
        {details.map((line) => (
          <p key={line} className="text-[11px] text-slate-500 leading-4">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};
