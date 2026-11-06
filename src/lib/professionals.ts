// Regras para profissionais inativados (tela Equipe).
//
// - Listas de ESCOLHA (novo agendamento, responsável do paciente, atestado,
//   evolução, avaliação) mostram só ativos. Se o registro aberto já aponta
//   para alguém inativo, essa pessoa continua na lista, marcada, para o campo
//   não aparecer em branco nem trocar de valor sozinho.
// - HISTÓRICO (cores da agenda, filtros, nomes em evoluções e comissões)
//   continua mostrando todo mundo.

type WithActive = { id: string; active?: boolean | null };

export const INACTIVE_LABEL = " (inativa)";

// Bancos sem a migration de inativação não têm a coluna: todos contam como ativos.
export function isActiveProfessional(professional: WithActive): boolean {
  return professional.active !== false;
}

export function professionalsForSelection<T extends WithActive>(
  professionals: T[],
  selectedId?: string | null,
): T[] {
  return professionals.filter(
    (professional) =>
      isActiveProfessional(professional) || professional.id === selectedId,
  );
}

export function withInactiveLabel(name: string, professional: WithActive): string {
  return isActiveProfessional(professional) ? name : `${name}${INACTIVE_LABEL}`;
}

// Ativos primeiro, mantendo a ordem original dentro de cada grupo.
export function activeFirst<T extends WithActive>(professionals: T[]): T[] {
  return [
    ...professionals.filter(isActiveProfessional),
    ...professionals.filter((professional) => !isActiveProfessional(professional)),
  ];
}

// O app pode ir ao ar antes da migration: nesse caso a consulta com `active`
// falha e refazemos sem a coluna em vez de quebrar a tela.
export function isMissingActiveColumn(error: { message?: string } | null): boolean {
  return (
    !!error?.message &&
    /\bactive\b/.test(error.message) &&
    /(does not exist|schema cache|could not find)/i.test(error.message)
  );
}
