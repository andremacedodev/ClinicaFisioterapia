import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, ChevronRight, HelpCircle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { HELP_ARTICLES, helpContextForPath } from "../../help/content";

/**
 * Botão "?" flutuante: mostra os tutoriais da tela atual.
 * Não aparece na própria Central de Ajuda.
 */
export const HelpButton = () => {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isAdmin = profile?.role === "admin";

  const context = helpContextForPath(pathname);
  const articles = useMemo(
    () =>
      (context?.articleIds ?? [])
        .map((id) => HELP_ARTICLES.find((article) => article.id === id))
        .filter((article): article is (typeof HELP_ARTICLES)[number] => !!article)
        .filter((article) => isAdmin || article.audience === "all"),
    [context, isAdmin],
  );

  // Fecha ao trocar de tela.
  useEffect(() => setOpen(false), [pathname]);

  // Fecha com Esc ou clique fora.
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
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (pathname.startsWith("/ajuda")) return null;

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Ajuda desta tela"
          className="fixed right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] lg:bottom-24 lg:right-8 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Ajuda
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {context ? `Dúvidas sobre ${context.title}` : "Dúvidas sobre o sistema"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar ajuda"
            >
              <X size={18} />
            </button>
          </div>

          {articles.length > 0 && (
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {articles.map((article) => (
                <li key={article.id}>
                  <Link
                    to={`/ajuda/${article.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {article.title}
                    <ChevronRight size={16} className="shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/ajuda"
            className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-brand-400"
          >
            <BookOpen size={16} /> Ver todos os tutoriais
          </Link>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        className="fixed right-4 z-[65] inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-lg transition hover:bg-brand-50 active:scale-95 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-8 lg:right-8 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-400"
      >
        <HelpCircle size={24} />
      </button>
    </>
  );
};
