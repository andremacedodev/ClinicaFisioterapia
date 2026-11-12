// Conteúdo da Central de Ajuda.
//
// Para criar ou corrigir um tutorial, edite só este arquivo.
// - Use **texto** para destacar nomes de botões, menus e campos.
// - `audience: "admin"` esconde o tutorial de quem não é administradora.
// - `image` em um passo é opcional (prints podem ser adicionados depois,
//   em public/ajuda/, por exemplo "/ajuda/novo-paciente-1.png").

export type HelpAudience = "all" | "admin";

export type HelpCategoryId =
  | "primeiros-passos"
  | "pacientes"
  | "agenda"
  | "prontuario"
  | "financeiro"
  | "comissoes"
  | "equipe"
  | "whatsapp-atestados";

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  description: string;
};

export type HelpStep = {
  text: string;
  tip?: string;
  image?: { src: string; alt: string };
};

export type HelpArticle = {
  id: string;
  category: HelpCategoryId;
  title: string;
  summary: string;
  audience: HelpAudience;
  keywords: string[];
  steps: HelpStep[];
  related?: string[];
};

export type HelpFaq = {
  id: string;
  question: string;
  answer: string;
  audience: HelpAudience;
  keywords: string[];
};

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "primeiros-passos", title: "Primeiros passos", description: "Entrar, instalar no celular e configurar a clínica" },
  { id: "pacientes", title: "Pacientes e pacotes", description: "Cadastro, pacotes de aulas e renovação" },
  { id: "agenda", title: "Agenda", description: "Aulas, presenças, faltas e reposições" },
  { id: "prontuario", title: "Prontuário", description: "Evoluções, avaliações e exames" },
  { id: "financeiro", title: "Financeiro", description: "Recebimentos, despesas e extrato" },
  { id: "comissoes", title: "Comissões", description: "Cálculo e pagamento das fisioterapeutas" },
  { id: "equipe", title: "Equipe", description: "Convites, comissão e saída de profissionais" },
  { id: "whatsapp-atestados", title: "WhatsApp e atestados", description: "Mensagens prontas e documentos" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "cadastrar-paciente-com-pacote",
    category: "pacientes",
    title: "Como cadastrar um paciente com pacote de aulas?",
    summary:
      "Cadastre o paciente e o pacote de uma vez: o sistema já coloca todas as aulas na agenda.",
    audience: "admin",
    keywords: ["novo paciente", "cadastro", "pacote", "aulas", "sessões", "dias fixos", "matrícula", "aluno"],
    steps: [
      {
        text: "No menu, clique em **Pacientes** e depois no botão azul **Novo Paciente**, no canto de cima da tela.",
      },
      {
        text: "Em **Dados Pessoais**, escreva o **Nome Completo** do paciente. Se tiver, preencha também a data de nascimento e o contato de emergência.",
      },
      {
        text: "Em **Contato**, coloque o **WhatsApp / Celular** do paciente.",
        tip: "É por esse número que você vai mandar a confirmação das aulas e as cobranças, então vale conferir.",
      },
      {
        text: "Em **Agenda e sessões contratadas**, informe a **Data de Início**, quantas **Sessões contratadas**, os **Dias fixos** da semana e o **Horário fixo das sessões**. Escolha também a **Fisioterapeuta responsável**.",
        tip: "Se aparecer o aviso **Horário lotado**, a turma daquele horário já está cheia. Escolha outro horário ou outro dia.",
      },
      {
        text: "Em **Financeiro**, coloque o **Valor por sessão**. O sistema calcula o total do pacote sozinho.",
      },
      {
        text: "Diga como o paciente vai pagar: **Pagou tudo agora**, **Vai pagar em parcelas para a clínica** ou **Ainda não pagou nada**.",
        tip: "Se escolher parcelas, cada parcela aparece depois em **Financeiro > Recebimentos**, com a data de vencimento.",
      },
      {
        text: "Clique em **Cadastrar e gerar sessões**. Pronto: as aulas já aparecem na **Agenda**, nos dias e horários que você escolheu.",
      },
    ],
    related: ["registrar-presenca-falta-reposicao", "registrar-pagamento-parcela"],
  },
  {
    id: "registrar-presenca-falta-reposicao",
    category: "agenda",
    title: "Como registrar presença, falta ou reposição?",
    summary:
      "Depois de cada aula, marque o que aconteceu. Isso atualiza as aulas restantes do pacote e a comissão.",
    audience: "admin",
    keywords: ["presença", "falta", "faltou", "reposição", "ausência", "justificada", "cancelar aula", "chamada", "status"],
    steps: [
      {
        text: "No menu, clique em **Agenda**.",
      },
      {
        text: "No calendário, clique no dia da aula. Os atendimentos daquele dia aparecem ao lado, em ordem de horário.",
        tip: "Para ver só as aulas de uma profissional, use o filtro **Todos os fisioterapeutas** e escolha o nome dela.",
      },
      {
        text: "No cartão do paciente, clique no que aconteceu: **Presença**, **Ausência justificada**, **Falta**, **Reposição** ou **Cancelada**. A opção escolhida fica destacada.",
      },
      {
        text: "Na dúvida sobre qual escolher: **Presença** é quando o paciente veio. **Ausência justificada** é quando ele avisou que não vinha: não conta como falta. **Falta** é quando não veio e não avisou: a aula conta como usada. **Reposição** é uma aula extra para compensar uma ausência. **Cancelada** não conta para nada.",
        tip: "Presenças, reposições e faltas entram na comissão da fisioterapeuta. Ausência justificada e cancelamento não entram.",
      },
      {
        text: "Atenção: cada pacote aceita até **2 ausências justificadas**. A partir da terceira, o sistema registra como **Falta** automaticamente.",
      },
    ],
    related: ["cadastrar-paciente-com-pacote"],
  },
  {
    id: "registrar-pagamento-parcela",
    category: "financeiro",
    title: "Como registrar o pagamento de uma parcela?",
    summary:
      "Quando o paciente pagar, registre no sistema para a parcela sair da lista de pendências.",
    audience: "admin",
    keywords: ["pagamento", "parcela", "recebimento", "pagou", "pix", "cartão", "dinheiro", "recibo", "baixa"],
    steps: [
      {
        text: "No menu, clique em **Financeiro** e depois na aba **Recebimentos**.",
      },
      {
        text: "A lista mostra as parcelas **Em aberto**. Para achar um paciente rápido, digite o nome em **Buscar paciente**.",
        tip: "Use **Vencimento mais antigo** para ver primeiro quem está atrasado há mais tempo.",
      },
      {
        text: "Na linha da parcela, clique em **Registrar**.",
      },
      {
        text: "Confira o **Valor recebido**, escolha a **Forma de pagamento** e a **Data do recebimento**. Depois clique em **Salvar**.",
        tip: "Se o paciente pagou só uma parte, coloque o valor que ele pagou. O que faltar continua aparecendo em aberto.",
      },
      {
        text: "Para entregar o recibo, mude o filtro para mostrar as parcelas pagas e clique no botão de recibo, ao lado de **Registrar**. Na janela de impressão, escolha **Salvar como PDF** se quiser mandar pelo WhatsApp.",
      },
    ],
    related: ["cadastrar-paciente-com-pacote"],
  },
];

export const HELP_FAQS: HelpFaq[] = [
  {
    id: "fisio-ve-financeiro",
    question: "A fisioterapeuta consegue ver o financeiro da clínica?",
    answer:
      "Não. A fisioterapeuta vê a agenda e a própria produção (a comissão dela). Os valores da clínica, as despesas e a comissão das outras ficam só com a administração.",
    audience: "all",
    keywords: ["acesso", "permissão", "fisioterapeuta", "financeiro", "privacidade"],
  },
  {
    id: "comissao-muda-passado",
    question: "Se eu mudar a comissão de alguém, as aulas antigas mudam?",
    answer:
      "Não. A comissão nova vale para as aulas a partir do momento em que você salvou. O que já aconteceu continua com a comissão antiga.",
    audience: "admin",
    keywords: ["comissão", "porcentagem", "valor fixo", "alterar"],
  },
  {
    id: "falta-justificada-diferenca",
    question: "Qual a diferença entre falta e ausência justificada?",
    answer:
      "Ausência justificada é quando o paciente avisou: a aula não conta como usada. Falta é quando ele não veio e não avisou: a aula conta como usada e entra na comissão. Cada pacote aceita até 2 ausências justificadas; a partir da terceira, o sistema registra como falta.",
    audience: "all",
    keywords: ["falta", "ausência", "justificada", "avisou"],
  },
  {
    id: "celular",
    question: "Dá para usar no celular?",
    answer:
      "Sim. O sistema funciona no navegador do celular, do tablet e do computador. No celular, você pode adicionar à tela inicial e abrir como um aplicativo.",
    audience: "all",
    keywords: ["celular", "tablet", "aplicativo", "instalar"],
  },
];
