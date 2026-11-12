import { useEffect, useState } from "react";
import {
  CLINIC_PROFILE_UPDATED_EVENT,
  ClinicProfile,
  fetchClinicProfile,
} from "../../lib/clinicProfile";

/**
 * Nome da clínica para o topo do menu lateral. Enquanto carrega, se a
 * clínica não tiver nome ou se a busca falhar, retorna null e quem usa
 * mostra "FisioOne". Atualiza na hora quando o nome é salvo em Configurações.
 */
export function useClinicDisplayName(clinicId: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) {
      setName(null);
      return;
    }
    let cancelled = false;
    fetchClinicProfile(clinicId)
      .then((clinic) => {
        if (!cancelled) setName(clinic.name?.trim() || null);
      })
      .catch((error: unknown) => {
        // Só um rótulo do menu: mantém "FisioOne", mas registra o motivo.
        console.error("Não foi possível carregar o nome da clínica para o menu:", error);
        if (!cancelled) setName(null);
      });

    const onUpdated = (event: Event) => {
      const clinic = (event as CustomEvent<ClinicProfile>).detail;
      if (clinic?.id === clinicId) setName(clinic.name?.trim() || null);
    };
    window.addEventListener(CLINIC_PROFILE_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(CLINIC_PROFILE_UPDATED_EVENT, onUpdated);
    };
  }, [clinicId]);

  return name;
}
