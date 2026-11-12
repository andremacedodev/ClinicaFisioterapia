import { clsx } from "clsx";

/**
 * Logo do produto FisioOne (opção "Pulso One"): a linha de pulso termina
 * num "1". É a marca do sistema — o logo de cada clínica continua sendo
 * enviado em Configurações e aparece nos documentos da clínica.
 *
 * Os mesmos traços estão em public/favicon.svg e public/logo-fisioone*.svg.
 */
export const FISIOONE_PULSE_PATH = "M10 37 H21 L26 29 L32 43 L41 13 V51";

type MarkProps = {
  /** Tamanho em px (largura = altura). */
  size?: number;
  className?: string;
  /** Texto para leitores de tela; sem ele o símbolo é decorativo. */
  title?: string;
};

export function FisioOneMark({ size = 40, className, title }: MarkProps) {
  // Em tamanhos pequenos o traço precisa ser mais grosso para continuar legível.
  const strokeWidth = size <= 20 ? 8 : size <= 32 ? 6.5 : 5.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="16" fill="#0284C7" />
      <path
        d={FISIOONE_PULSE_PATH}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
};

/** "Fisio" em azul-marinho + "One" em azul; no modo escuro, branco + azul-claro. */
export function FisioOneWordmark({ className }: WordmarkProps) {
  return (
    <span
      className={clsx("notranslate font-bold tracking-tight leading-none", className)}
      translate="no"
    >
      <span className="text-sky-900 dark:text-white">Fisio</span>
      <span className="text-sky-600 dark:text-sky-300">One</span>
    </span>
  );
}

type LogoProps = {
  markSize?: number;
  wordmarkClassName?: string;
  tagline?: string;
  className?: string;
};

/** Símbolo + nome lado a lado, com frase opcional embaixo do nome. */
export function FisioOneLogo({
  markSize = 40,
  wordmarkClassName = "text-xl",
  tagline,
  className,
}: LogoProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <FisioOneMark size={markSize} />
      <div className="flex flex-col items-start gap-1 text-left">
        <FisioOneWordmark className={wordmarkClassName} />
        {tagline && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{tagline}</span>
        )}
      </div>
    </div>
  );
}
