// Rótulos de paciente usados em várias telas.

export const PATIENT_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  inadimplente: "Inadimplente",
  inativo: "Inativo",
  encerrado: "Encerrado",
};

export const PATIENT_STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ativo: "success",
  pausado: "warning",
  inadimplente: "danger",
  inativo: "neutral",
  encerrado: "neutral",
};

export function patientStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sem status";
  return PATIENT_STATUS_LABEL[status] ?? status;
}

// Valores gravados em patients.gender. O cadastro antigo gravava "other"
// como padrão escondido (ninguém escolhia), por isso "other" é tratado como
// "Não informado"; a opção "Outro" escolhida de verdade grava "outro".
export const GENDER_OPTIONS = [
  { value: "", label: "Não informado" },
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "outro", label: "Outro" },
] as const;

const GENDER_LABEL: Record<string, string> = {
  feminino: "Feminino",
  female: "Feminino",
  masculino: "Masculino",
  male: "Masculino",
  outro: "Outro",
};

export function genderLabel(value: string | null | undefined): string {
  if (!value) return "Não informado";
  return GENDER_LABEL[value.toLowerCase()] ?? "Não informado";
}

/** Valor para o formulário: o "other" antigo vira "Não informado". */
export function genderFormValue(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized === "female") return "feminino";
  if (normalized === "male") return "masculino";
  return GENDER_OPTIONS.some((option) => option.value === normalized) ? normalized : "";
}
