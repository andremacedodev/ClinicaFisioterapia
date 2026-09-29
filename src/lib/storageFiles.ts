import { supabase } from "./supabase";

export type PrivateBucket = "patient-files" | "transaction-docs";

// Links assinados expiram rápido: os buckets são privados (dados sensíveis).
const SIGNED_URL_TTL_SECONDS = 60 * 10;

/**
 * Anexos novos são salvos como caminho dentro do bucket. Registros antigos
 * guardam a URL pública completa; extraímos o caminho para continuar
 * funcionando depois que o bucket virou privado.
 */
export function resolveStoragePath(
  bucket: PrivateBucket,
  value: string,
): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;

  const marker = new RegExp(
    `/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`,
  );
  const match = value.match(marker);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function createSignedFileUrl(
  bucket: PrivateBucket,
  value: string,
  options?: { download?: boolean },
): Promise<string> {
  const path = resolveStoragePath(bucket, value);
  if (!path) throw new Error("Arquivo não encontrado.");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
      download: options?.download,
    });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Não foi possível abrir o arquivo: ${error?.message ?? "link inválido"}`,
    );
  }

  return data.signedUrl;
}

/**
 * Abre o arquivo numa nova aba. A aba é aberta antes da chamada assíncrona
 * para não ser barrada pelo bloqueador de pop-ups.
 */
export async function openStorageFile(
  bucket: PrivateBucket,
  value: string,
  options?: { download?: boolean },
): Promise<void> {
  const target = options?.download ? null : window.open("", "_blank");

  try {
    const url = await createSignedFileUrl(bucket, value, options);
    if (target) {
      target.opener = null;
      target.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    target?.close();
    window.alert(error instanceof Error ? error.message : String(error));
  }
}

export function storageFileName(value: string): string {
  const withoutQuery = value.split(/[?#]/)[0];
  const name = decodeURIComponent(withoutQuery.split("/").pop() ?? "");
  return name.replace(/^\d+_/, "");
}
