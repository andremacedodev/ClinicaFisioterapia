import { supabase } from "./supabase";

export const CLINIC_ASSETS_BUCKET = "clinic-assets";

export type ClinicProfile = {
  id: string;
  name: string;
  owner_id: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  logo_path: string | null;
};

const EMPTY_OPTIONAL_FIELDS = {
  cnpj: null,
  phone: null,
  email: null,
  address_zip: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_district: null,
  address_city: null,
  address_state: null,
  logo_path: null,
};

export const CLINIC_PROFILE_COLUMNS =
  "id, name, owner_id, cnpj, phone, email, address_zip, address_street, address_number, address_complement, address_district, address_city, address_state, logo_path";

export async function fetchClinicProfile(
  clinicId: string,
): Promise<ClinicProfile> {
  const { data, error } = await supabase
    .from("clinics")
    .select(CLINIC_PROFILE_COLUMNS)
    .eq("id", clinicId)
    .single();

  if (!error) return data as ClinicProfile;

  // Banco sem a migration dos dados cadastrais: segue só com o nome.
  if (error.code === "42703" || /column .* does not exist/i.test(error.message)) {
    const fallback = await supabase
      .from("clinics")
      .select("id, name, owner_id")
      .eq("id", clinicId)
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    return { ...EMPTY_OPTIONAL_FIELDS, ...fallback.data } as ClinicProfile;
  }

  throw new Error(error.message);
}

export function clinicLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return supabase.storage.from(CLINIC_ASSETS_BUCKET).getPublicUrl(logoPath).data
    .publicUrl;
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCnpj(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCep(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function formatClinicAddress(clinic: ClinicProfile | null): string {
  if (!clinic) return "";
  const street = [clinic.address_street, clinic.address_number]
    .filter(Boolean)
    .join(", ");
  const firstLine = [street, clinic.address_complement].filter(Boolean).join(" - ");
  const cityState = [clinic.address_city, clinic.address_state]
    .filter(Boolean)
    .join("/");
  const cep = clinic.address_zip ? `CEP ${formatCep(clinic.address_zip)}` : "";

  return [firstLine, clinic.address_district, cityState, cep]
    .filter(Boolean)
    .join(" - ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Estilos do cabeçalho institucional usado em atestados e recibos. */
export const CLINIC_HEADER_CSS = `
  .clinic-header { display: flex; align-items: center; gap: 16px; }
  .clinic-header img { max-height: 64px; max-width: 160px; object-fit: contain; }
  .clinic-header .clinic-name { font-size: 20px; font-weight: 700; }
  .clinic-header .clinic-details { margin-top: 4px; font-size: 11px; line-height: 1.5; color: #64748b; }
`;

/**
 * Cabeçalho com logo, nome e dados que a clínica preencheu. Campos vazios
 * simplesmente não aparecem.
 */
export function clinicHeaderHtml(clinic: ClinicProfile | null): string {
  const name = clinic?.name ?? "Clínica";
  const logoUrl = clinicLogoUrl(clinic?.logo_path);
  const contact = [
    clinic?.phone ? formatPhone(clinic.phone) : "",
    clinic?.email ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  const details = [
    clinic?.cnpj ? `CNPJ ${formatCnpj(clinic.cnpj)}` : "",
    formatClinicAddress(clinic),
    contact,
  ].filter(Boolean);

  return `
    <div class="clinic-header">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="" />` : ""}
      <div>
        <div class="clinic-name">${escapeHtml(name)}</div>
        ${
          details.length
            ? `<div class="clinic-details">${details.map(escapeHtml).join("<br />")}</div>`
            : ""
        }
      </div>
    </div>
  `;
}
