import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bell, Cake, MessageCircle, X } from "lucide-react";
import { clsx } from "clsx";
import { whatsappLink } from "../../lib/birthdays";
import type { BirthdayNotifications } from "./useBirthdayNotifications";

/** Número vermelho do sino (some quando é zero). */
export function NotificationBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        "absolute inline-flex min-w-[1.15rem] h-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[0.68rem] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950",
        className,
      )}
      aria-hidden="true"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Lista de avisos: aniversariantes de hoje e dos próximos 7 dias. */
export function NotificationList({ notifications }: { notifications: BirthdayNotifications }) {
  const { birthdays, loading, error } = notifications;

  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    );
  }
  if (loading && birthdays.length === 0) {
    return <p className="text-sm text-slate-500">Carregando avisos…</p>;
  }
  if (birthdays.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum aniversariante hoje nem nos próximos 7 dias.</p>;
  }

  return (
    <ul className="space-y-2">
      {birthdays.map((person) => {
        const link = whatsappLink(person.phone);
        const isToday = person.daysUntil === 0;
        return (
          <li
            key={person.id}
            className={clsx(
              "flex items-center justify-between gap-3 rounded-xl p-3",
              isToday
                ? "bg-pink-50 ring-1 ring-pink-200 dark:bg-pink-900/20 dark:ring-pink-900/50"
                : "bg-slate-50 dark:bg-slate-800/50",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/30">
                <Cake size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{person.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isToday ? (
                    <strong className="text-pink-700 dark:text-pink-300">Faz {person.age} anos hoje</strong>
                  ) : (
                    <>
                      {person.label} · {person.age} anos
                    </>
                  )}
                </p>
              </div>
            </div>
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                aria-label={`Abrir WhatsApp de ${person.name}`}
                title="Parabenizar pelo WhatsApp"
              >
                <MessageCircle size={18} />
              </a>
            ) : (
              <span className="text-xs text-slate-400" title="Paciente sem telefone">
                Sem telefone
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Sino do menu lateral (computador): abre um painel com os avisos. */
export function NotificationBell({ notifications }: { notifications: BirthdayNotifications }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { unseenCount, today, markSeen } = notifications;

  useEffect(() => {
    if (open) markSeen();
  }, [open, markSeen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const label =
    unseenCount > 0
      ? `Avisos: ${unseenCount} ${unseenCount === 1 ? "aniversariante" : "aniversariantes"} hoje`
      : "Avisos";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          open
            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900",
        )}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
      >
        <Bell size={20} className={unseenCount > 0 ? "text-rose-600" : undefined} />
        <NotificationBadge count={unseenCount} className="-right-0.5 -top-0.5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Avisos"
          className="fixed left-[16.5rem] top-4 z-[70] w-[min(23rem,calc(100vw-18rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Avisos</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {today.length > 0
                  ? `${today.length} ${today.length === 1 ? "aniversariante" : "aniversariantes"} hoje`
                  : "Aniversariantes dos próximos 7 dias"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar avisos"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-3">
            <NotificationList notifications={notifications} />
          </div>
        </div>
      )}
    </>
  );
}
