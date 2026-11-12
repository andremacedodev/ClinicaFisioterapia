import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Percent,
  Rocket,
  Search,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  HELP_FAQS,
  type HelpArticle,
  type HelpCategoryId,
  type HelpFaq,
} from "../help/content";

const CATEGORY_ICONS: Record<HelpCategoryId, LucideIcon> = {
  "primeiros-passos": Rocket,
  pacientes: Users,
  agenda: Calendar,
  prontuario: ClipboardList,
  financeiro: CreditCard,
  comissoes: Percent,
  equipe: UserCog,
  "whatsapp-atestados": MessageSquare,
};

// Busca sem diferenciar maiúsculas nem acentos ("presenca" acha "Presença").
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function stripMarks(text: string): string {
  return text.replace(/\*\*/g, "");
}

function matches(query: string, fields: string[]): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const haystack = normalize(fields.map(stripMarks).join(" "));
  return words.every((word) => haystack.includes(word));
}

// Converte **texto** em negrito.
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong
            key={index}
            className="font-semibold text-slate-900 dark:text-white"
          >
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export const Help = () => {
  const { profile } = useAuth();
  const { articleId } = useParams<{ articleId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const isAdmin = profile?.role === "admin";

  const articles = useMemo(
    () =>
      HELP_ARTICLES.filter((article) => isAdmin || article.audience === "all"),
    [isAdmin],
  );
  const faqs = useMemo(
    () => HELP_FAQS.filter((faq) => isAdmin || faq.audience === "all"),
    [isAdmin],
  );

  const selectedCategory = searchParams.get(
    "categoria",
  ) as HelpCategoryId | null;
  const trimmedQuery = query.trim();

  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null;
    return {
      articles: articles.filter((article) =>
        matches(trimmedQuery, [
          article.title,
          article.summary,
          ...article.keywords,
          ...article.steps.flatMap((step) => [step.text, step.tip ?? ""]),
        ]),
      ),
      faqs: faqs.filter((faq) =>
        matches(trimmedQuery, [faq.question, faq.answer, ...faq.keywords]),
      ),
    };
  }, [articles, faqs, trimmedQuery]);

  if (articleId) {
    const article = HELP_ARTICLES.find((item) => item.id === articleId);
    return (
      <HelpShell>
        <Link
          to="/ajuda"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          <ArrowLeft size={16} /> Voltar para a Ajuda
        </Link>
        {!article ? (
          <Card>
            <p className="text-slate-600 dark:text-slate-300">
              Não encontramos este tutorial. Ele pode ter mudado de endereço.
            </p>
          </Card>
        ) : !isAdmin && article.audience === "admin" ? (
          <Card>
            <p className="text-slate-600 dark:text-slate-300">
              Este tutorial é para a administração da clínica. Se você precisa
              fazer isso, peça ajuda à administradora.
            </p>
          </Card>
        ) : (
          <ArticleView
            article={article}
            related={(article.related ?? [])
              .map((id) => articles.find((item) => item.id === id))
              .filter((item): item is HelpArticle => !!item)}
          />
        )}
      </HelpShell>
    );
  }

  const visibleCategories = HELP_CATEGORIES.map((category) => ({
    ...category,
    articles: articles.filter((article) => article.category === category.id),
  })).filter((category) => category.articles.length > 0);

  const activeCategory = visibleCategories.find(
    (category) => category.id === selectedCategory,
  );

  return (
    <HelpShell>
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Ajuda
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Tire suas dúvidas sobre o sistema, com passo a passo em linguagem
          simples.
        </p>
      </header>

      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Digite sua dúvida. Ex.: "falta", "cadastrar paciente", "pagamento"'
          aria-label="Buscar na Ajuda"
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-12 text-base shadow-sm outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Limpar busca"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {searchResults ? (
        <section className="space-y-6" aria-live="polite">
          {searchResults.articles.length === 0 &&
          searchResults.faqs.length === 0 ? (
            <Card>
              <p className="text-slate-600 dark:text-slate-300">
                Nada encontrado para “{trimmedQuery}”. Tente outra palavra, como
                “paciente”, “agenda” ou “pagamento”.
              </p>
            </Card>
          ) : (
            <>
              {searchResults.articles.length > 0 && (
                <ArticleList
                  title="Tutoriais"
                  articles={searchResults.articles}
                />
              )}
              {searchResults.faqs.length > 0 && (
                <FaqList faqs={searchResults.faqs} />
              )}
            </>
          )}
        </section>
      ) : activeCategory ? (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            <ArrowLeft size={16} /> Todos os assuntos
          </button>
          <ArticleList
            title={activeCategory.title}
            articles={activeCategory.articles}
          />
        </section>
      ) : (
        <>
          {visibleCategories.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                Assuntos
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCategories.map((category) => {
                  const Icon = CATEGORY_ICONS[category.id];
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        setSearchParams({ categoria: category.id })
                      }
                      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                        <Icon size={22} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900 dark:text-white">
                          {category.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-500">
                          {category.description}
                        </span>
                        <span className="mt-2 block text-xs font-medium text-brand-700 dark:text-brand-400">
                          {category.articles.length === 1
                            ? "1 tutorial"
                            : `${category.articles.length} tutoriais`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {faqs.length > 0 && <FaqList faqs={faqs} />}
        </>
      )}
    </HelpShell>
  );
};

const HelpShell = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-500">
    {children}
  </div>
);

const ArticleList = ({
  title,
  articles,
}: {
  title: string;
  articles: HelpArticle[];
}) => (
  <div>
    <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
      {title}
    </h2>
    <ul className="space-y-3">
      {articles.map((article) => (
        <li key={article.id}>
          <Link
            to={`/ajuda/${article.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900 dark:text-white">
                {article.title}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                {article.summary}
              </span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-slate-400" />
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const FaqList = ({ faqs }: { faqs: HelpFaq[] }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
        Perguntas frequentes
      </h2>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {faqs.map((faq) => {
          const open = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : faq.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800/50"
              >
                {faq.question}
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <p className="px-4 pb-4 text-slate-600 dark:text-slate-300">
                  <RichText text={faq.answer} />
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const ArticleView = ({
  article,
  related,
}: {
  article: HelpArticle;
  related: HelpArticle[];
}) => {
  const category = HELP_CATEGORIES.find((item) => item.id === article.category);
  return (
    <article className="space-y-6">
      <header>
        {category && (
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            {category.title}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
          {article.title}
        </h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
          {article.summary}
        </p>
      </header>

      <ol className="space-y-4">
        {article.steps.map((step, index) => (
          <li
            key={index}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base font-bold text-white"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-base leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="sr-only">Passo {index + 1}: </span>
                <RichText text={step.text} />
              </p>
              {step.tip && (
                <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <Lightbulb
                    size={18}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="sr-only">Dica: </span>
                    <RichText text={step.tip} />
                  </span>
                </p>
              )}
              {step.image && (
                <img
                  src={step.image.src}
                  alt={step.image.alt}
                  loading="lazy"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="flex items-center gap-2 text-sm text-slate-500">
        <HelpCircle size={16} aria-hidden="true" /> Ainda com dúvida? Fale com o
        suporte do sistema.
      </p>

      {related.length > 0 && (
        <ArticleList title="Veja também" articles={related} />
      )}
    </article>
  );
};
