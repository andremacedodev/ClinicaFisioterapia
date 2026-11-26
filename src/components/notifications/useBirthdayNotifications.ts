import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { upcomingBirthdays, type UpcomingBirthday } from "../../lib/birthdays";

type Access = { id: string; clinic_id: string | null; role: string | null } | null | undefined;

function todayKey(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function storageKey(clinicId: string, userId: string, day: string): string {
  return `fisioone:aniversarios-vistos:${clinicId}:${userId}:${day}`;
}

function readSeen(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Aniversariantes de hoje e dos próximos 7 dias para o sino de avisos.
 * Mesma regra do painel: pacientes ativos; a fisioterapeuta vê só os dela.
 * O número no sino conta os aniversariantes de HOJE ainda não vistos neste
 * aparelho; abrir os avisos marca como vistos (até o dia seguinte).
 */
export function useBirthdayNotifications(access: Access) {
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(todayKey);
  const [seen, setSeen] = useState<string[]>([]);

  const clinicId = access?.clinic_id ?? null;
  const userId = access?.id ?? null;
  const role = access?.role ?? null;

  const load = useCallback(async () => {
    if (!clinicId || !userId) return;
    setLoading(true);
    let query = supabase
      .from("patients")
      .select("id, full_name, phone, birth_date")
      .eq("clinic_id", clinicId)
      .eq("status", "ativo")
      .not("birth_date", "is", null);
    if (role === "physio") query = query.eq("responsible_professional_id", userId);

    const { data, error: loadError } = await query;
    setLoading(false);
    if (loadError) {
      setError(`Não foi possível carregar os aniversariantes: ${loadError.message}`);
      return;
    }
    setError(null);
    setBirthdays(upcomingBirthdays(data ?? [], new Date(), 7));
  }, [clinicId, userId, role]);

  // Carrega ao entrar e de novo quando a pessoa volta para a aba
  // (se o sistema ficou aberto de um dia para o outro, o dia muda).
  useEffect(() => {
    void load();
    const onFocus = () => {
      setDay(todayKey());
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    if (!clinicId || !userId) return;
    setSeen(readSeen(storageKey(clinicId, userId, day)));
  }, [clinicId, userId, day]);

  const today = useMemo(() => birthdays.filter((item) => item.daysUntil === 0), [birthdays]);
  const unseenCount = today.filter((item) => !seen.includes(item.id)).length;

  const markSeen = useCallback(() => {
    if (!clinicId || !userId || today.length === 0) return;
    // Já vistos: não muda o estado (evita repetir a gravação a cada render).
    if (today.every((item) => seen.includes(item.id))) return;
    const ids = Array.from(new Set([...seen, ...today.map((item) => item.id)]));
    setSeen(ids);
    try {
      window.localStorage.setItem(storageKey(clinicId, userId, day), JSON.stringify(ids));
    } catch {
      // Navegador sem armazenamento: o número volta ao recarregar, sem prejuízo.
    }
  }, [clinicId, userId, day, seen, today]);

  return { birthdays, today, unseenCount, loading, error, markSeen, reload: load };
}

export type BirthdayNotifications = ReturnType<typeof useBirthdayNotifications>;
