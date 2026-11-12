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
  // ── Primeiros passos ────────────────────────────────────────────────────────
  {
    id: "instalar-no-celular",
    category: "primeiros-passos",
    title: "Como usar o sistema no celular?",
    summary: "Coloque o sistema na tela inicial do celular e abra como se fosse um aplicativo.",
    audience: "all",
    keywords: ["celular", "aplicativo", "app", "instalar", "android", "iphone", "tela inicial", "atalho"],
    steps: [
      { text: "No celular, abra o navegador (**Chrome** no Android ou **Safari** no iPhone) e entre no endereço do sistema com o seu e-mail e senha." },
      {
        text: "No **Android (Chrome)**: toque nos **três pontinhos** no canto de cima e escolha **Adicionar à tela inicial** ou **Instalar aplicativo**.",
      },
      {
        text: "No **iPhone (Safari)**: toque no botão **Compartilhar** (o quadrado com uma seta para cima) e escolha **Adicionar à Tela de Início**.",
      },
      {
        text: "Pronto: o ícone aparece junto com os seus outros aplicativos. No celular, o menu fica embaixo da tela; os itens que não couberem estão em **Mais**.",
      },
    ],
  },
  {
    id: "configurar-clinica",
    category: "primeiros-passos",
    title: "Como colocar o logo e os dados da clínica?",
    summary: "O logo e os dados da clínica aparecem nos atestados, recibos e relatórios.",
    audience: "admin",
    keywords: ["logo", "logomarca", "configurações", "cnpj", "endereço", "dados da clínica", "crefito", "registro profissional"],
    steps: [
      { text: "No menu, clique em **Configurações**." },
      {
        text: "Em **Logo**, clique em **Enviar logo** e escolha a imagem no computador ou no celular.",
        tip: "Use uma imagem **PNG, JPG ou WEBP** de até **2 MB**. Imagens mais largas do que altas ficam melhores no topo dos documentos.",
      },
      {
        text: "Em **Dados da clínica**, confira o **Nome da clínica**, **CNPJ**, **Telefone / WhatsApp**, **E-mail** e o **Endereço**. Depois clique em **Salvar dados da clínica**.",
        tip: "Somente a pessoa que criou a clínica no sistema consegue alterar esses dados.",
      },
      {
        text: "Em **Meu registro profissional**, escreva o seu CREFITO (por exemplo, **CREFITO 12345-F/MT**) e clique em **Salvar registro**. Ele entra sozinho nos atestados que você emitir.",
      },
    ],
    related: ["emitir-atestado", "comissao-padrao"],
  },

  // ── Pacientes ───────────────────────────────────────────────────────────────
  {
    id: "renovar-pacote",
    category: "pacientes",
    title: "Como renovar o pacote de um paciente?",
    summary: "Quando as aulas do pacote acabam, renove para gerar as próximas aulas e as novas parcelas.",
    audience: "admin",
    keywords: ["renovar", "renovação", "novo pacote", "acabou", "aulas restantes"],
    steps: [
      { text: "No menu, clique em **Pacientes** e encontre o paciente (você pode digitar o nome em **Buscar**)." },
      { text: "No cartão do paciente, clique em **Renovar Pacote**." },
      {
        text: "Confira a **Data de Início**, as **Sessões contratadas**, os **Dias fixos**, o **Horário fixo das sessões** e o **Valor por sessão**. Ajuste o que mudou.",
      },
      { text: "Diga como o paciente vai pagar o novo pacote, como no cadastro." },
      { text: "Clique em **Renovar e gerar sessões**. As novas aulas entram na **Agenda** e as parcelas, em **Financeiro > Recebimentos**." },
    ],
    related: ["cadastrar-paciente-com-pacote", "registrar-pagamento-parcela"],
  },
  {
    id: "editar-pausar-paciente",
    category: "pacientes",
    title: "Como editar os dados ou pausar um paciente?",
    summary: "Corrija telefone e endereço, ou mude a situação do paciente (pausado, inadimplente, encerrado).",
    audience: "admin",
    keywords: ["editar", "alterar", "telefone", "endereço", "pausar", "pausado", "inadimplente", "encerrado", "inativo", "status do paciente", "observação"],
    steps: [
      { text: "No menu, clique em **Pacientes** e encontre o paciente." },
      { text: "No cartão do paciente, clique em **Editar paciente**." },
      {
        text: "Corrija o que precisar. Para mudar a situação, use **Status do cliente**: **Ativo**, **Pausado**, **Inadimplente**, **Encerrado** ou **Inativo**.",
        tip: "Use **Observação rápida** para lembretes que aparecem no cartão do paciente, como \"Viajou, retorna dia 15\".",
      },
      { text: "Clique em **Salvar alterações**." },
    ],
  },

  // ── Agenda ──────────────────────────────────────────────────────────────────
  {
    id: "marcar-aula-avulsa",
    category: "agenda",
    title: "Como marcar uma aula avulsa ou uma reposição?",
    summary: "Marque um atendimento fora do pacote fixo: aula extra, reposição ou outro tipo de sessão.",
    audience: "admin",
    keywords: ["marcar", "agendar", "aula avulsa", "nova aula", "reposição", "atendimento", "novo agendamento", "drenagem", "massagem"],
    steps: [
      { text: "No menu, clique em **Agenda** e depois em **Novo atendimento**." },
      {
        text: "Em **Paciente**, escolha o paciente. Se ele tiver pacote ativo, o sistema mostra o pacote e já calcula o número da aula.",
      },
      {
        text: "Escolha a **Fisioterapeuta responsável por esta aula**, a **Data**, o **Início** e o **Fim**, e o **Tipo de Sessão** (Pilates, Fisioterapia, Drenagem linfática e outros).",
        tip: "Se for uma reposição, mude o **Status** para **Reposição**.",
      },
      { text: "Confira o **Valor bruto da aula** e, se quiser, escreva em **Observações**." },
      { text: "Clique em **Criar Agendamento**. A aula aparece na Agenda no dia escolhido." },
    ],
    related: ["registrar-presenca-falta-reposicao"],
  },
  {
    id: "ver-minha-agenda",
    category: "agenda",
    title: "Como ver as minhas aulas na agenda?",
    summary: "Veja os atendimentos do dia e quantas vagas tem em cada horário.",
    audience: "all",
    keywords: ["minha agenda", "minhas aulas", "horários", "lotação", "vagas", "turma", "dia"],
    steps: [
      { text: "No menu, clique em **Agenda**." },
      { text: "No calendário, clique no dia. Os atendimentos aparecem ao lado, em ordem de horário." },
      { text: "Para ver só as suas aulas, use o filtro **Todos os fisioterapeutas** e escolha o seu nome." },
      {
        text: "Em **Lotação por sessão** você vê quantos alunos tem em cada horário (por exemplo, **4/5** quer dizer 4 alunos para 5 vagas). Horário cheio aparece em vermelho.",
        tip: "Marcar presença, falta ou mudar uma aula é feito pela administração da clínica.",
      },
    ],
  },

  // ── Prontuário ──────────────────────────────────────────────────────────────
  {
    id: "escrever-evolucao",
    category: "prontuario",
    title: "Como escrever a evolução do atendimento?",
    summary: "Registre o que foi feito na sessão. Dá para falar em vez de digitar.",
    audience: "all",
    keywords: ["evolução", "prontuário", "anotação", "sessão", "ditado", "voz", "microfone", "protocolos", "conduta"],
    steps: [
      { text: "No menu, clique em **Pacientes** e, no cartão do paciente, clique em **Prontuário**." },
      { text: "Em **Nova Evolução Clínica**, confira o **Profissional responsável**." },
      {
        text: "Escreva o que foi feito no atendimento. Se preferir falar, toque no **microfone** e fale; o texto aparece sozinho. Toque de novo para parar.",
        tip: "O ditado por voz funciona no **Chrome** ou no **Edge**. Na primeira vez, o navegador pede permissão para usar o microfone: toque em **Permitir**.",
      },
      { text: "Para ganhar tempo, clique em **Protocolos** e escolha um modelo de texto pronto. Depois é só ajustar." },
      { text: "Se tiver exame ou documento, clique em **Anexar Exame** antes de salvar." },
      { text: "Clique em **Salvar Evolução**. Ela aparece na **Linha do Tempo** do paciente, com data e nome da profissional." },
    ],
    related: ["avaliacao-pilates", "anexar-documentos"],
  },
  {
    id: "avaliacao-pilates",
    category: "prontuario",
    title: "Como fazer a avaliação fisioterapêutica de Pilates?",
    summary: "Preencha a ficha de avaliação completa, dividida em partes.",
    audience: "all",
    keywords: ["avaliação", "ficha", "postural", "mobilidade", "testes funcionais", "flexibilidade", "força muscular", "conduta", "anamnese"],
    steps: [
      { text: "Abra o **Prontuário** do paciente e clique na aba **Avaliações Fisioterapêuticas**." },
      { text: "Clique em **Nova Avaliação**." },
      {
        text: "A ficha é dividida em partes, nos botões de cima: **Dados da Avaliação**, **Avaliação Postural**, **Mobilidade**, **Testes Funcionais**, **Flexibilidade**, **Força Muscular** e **Conduta**. Preencha cada uma.",
        tip: "Pode passar de uma parte para outra à vontade: o que você já preencheu continua lá até salvar.",
      },
      { text: "No fim, clique em **Salvar Avaliação**." },
      {
        text: "As avaliações ficam na lista da aba. Use o **olho** para abrir, o **lápis** para editar ou a **lixeira** para excluir.",
      },
    ],
    related: ["escrever-evolucao"],
  },
  {
    id: "anexar-documentos",
    category: "prontuario",
    title: "Como anexar exames e documentos do paciente?",
    summary: "Guarde exames, laudos e fotos no prontuário, com acesso só para a equipe.",
    audience: "all",
    keywords: ["anexar", "exame", "documento", "laudo", "arquivo", "pdf", "foto", "upload"],
    steps: [
      { text: "Abra o **Prontuário** do paciente." },
      {
        text: "Clique em **Anexar Exame** (junto da evolução) ou em **Adicionar Exame**, em **Ações Rápidas**, e escolha o arquivo.",
      },
      {
        text: "Para ver o que já foi anexado, clique na aba **Documentos**. Use **Abrir** para ver ou **Download** para baixar.",
        tip: "Os arquivos são privados: só abrem para quem tem acesso ao prontuário, por um link que expira.",
      },
    ],
    related: ["escrever-evolucao"],
  },
  {
    id: "historico-aulas-paciente",
    category: "prontuario",
    title: "Como ver o histórico de aulas e presenças do paciente?",
    summary: "Veja quantas aulas o paciente tem, quantas restam e como foi a frequência.",
    audience: "all",
    keywords: ["histórico", "frequência", "presenças", "faltas", "aulas restantes", "contratadas", "ficha clínica"],
    steps: [
      { text: "Abra o **Prontuário** do paciente e clique na aba **Histórico de Aulas**." },
      {
        text: "No topo aparecem os números: **Contratadas**, **Restantes**, **Presenças**, **Faltas**, **Ausências justificadas**, **Reposições** e **Canceladas**.",
      },
      { text: "Embaixo fica o **Histórico completo da agenda**, aula por aula." },
      { text: "Os dados pessoais e as observações clínicas ficam na aba **Ficha Clínica**." },
    ],
  },

  // ── Financeiro ──────────────────────────────────────────────────────────────
  {
    id: "lancar-despesa",
    category: "financeiro",
    title: "Como lançar e pagar uma despesa?",
    summary: "Registre as contas da clínica (aluguel, água, luz) e marque quando forem pagas.",
    audience: "admin",
    keywords: ["despesa", "conta", "pagar", "aluguel", "água", "luz", "fornecedor", "comprovante", "boleto", "saída"],
    steps: [
      { text: "No menu, clique em **Financeiro** e depois na aba **Despesas**." },
      { text: "Clique em **Nova despesa**." },
      {
        text: "Preencha o **Valor** e a **Categoria**. Em **Situação**, escolha **Já foi paga** (e informe **Pago em**) ou **Ainda vou pagar** (e informe **Vence em**).",
      },
      {
        text: "Se quiser, escreva uma **Descrição** (por exemplo, \"aluguel de outubro\") e anexe o boleto ou comprovante em **Escolher arquivo**. Clique em **Salvar despesa**.",
      },
      {
        text: "Quando pagar uma conta que estava em aberto, encontre-a em **A pagar** e clique em **Pagar**.",
        tip: "No topo você vê o que está **Vencido**, o que **Vence em 7 dias** e o total **Pago no período**.",
      },
    ],
    related: ["extrato-relatorio"],
  },
  {
    id: "extrato-relatorio",
    category: "financeiro",
    title: "Como ver o extrato e tirar um relatório em PDF?",
    summary: "Veja tudo o que entrou e saiu num período e gere um relatório para guardar ou enviar.",
    audience: "admin",
    keywords: ["extrato", "relatório", "pdf", "entradas", "saídas", "histórico financeiro", "contador", "mês"],
    steps: [
      { text: "No menu, clique em **Financeiro** e depois na aba **Extrato**." },
      {
        text: "Escolha o período em **De** e **Até**, ou clique em **Últimos 30 dias**. A lista mostra entradas, saídas e comissões pagas.",
      },
      { text: "Para o relatório, clique em **Exportar PDF**, escolha as datas e as informações que devem aparecer, e clique em **Gerar PDF**." },
      {
        text: "O relatório abre em outra aba. Na janela de impressão, escolha **Salvar como PDF**.",
        tip: "É esse arquivo que você pode mandar para o contador.",
      },
    ],
    related: ["lancar-despesa"],
  },

  // ── Comissões ───────────────────────────────────────────────────────────────
  {
    id: "pagar-comissao",
    category: "comissoes",
    title: "Como pagar a comissão das fisioterapeutas?",
    summary: "Veja quanto cada fisioterapeuta tem a receber no período e registre o pagamento.",
    audience: "admin",
    keywords: ["comissão", "pagar comissão", "produção", "repasse", "fisioterapeuta", "excel", "planilha", "adiantamento"],
    steps: [
      { text: "No menu, clique em **Financeiro** e depois na aba **Comissões**." },
      {
        text: "Escolha o período em **Data Inicial** e **Data Final**. A tabela mostra, para cada fisioterapeuta: **Aulas**, **Faltas pagas**, **Bruto**, **Já pago** e **A pagar**.",
      },
      {
        text: "Na linha da fisioterapeuta, clique em **Registrar pagamento**, confira a **Data do pagamento** e o **Valor pago** e clique em **Confirmar**.",
        tip: "Pode pagar um valor menor que o total, como adiantamento. O restante continua em **A pagar**.",
      },
      { text: "Para conferir aula por aula, clique em **Exportar EXCEL**." },
    ],
    related: ["alterar-comissao", "minha-producao"],
  },
  {
    id: "alterar-comissao",
    category: "comissoes",
    title: "Como mudar a comissão de uma fisioterapeuta?",
    summary: "Defina porcentagem ou valor fixo por aula, separado para cada fisioterapeuta.",
    audience: "admin",
    keywords: ["comissão", "porcentagem", "valor fixo", "alterar comissão", "40%", "repasse"],
    steps: [
      { text: "No menu, clique em **Equipe**." },
      { text: "Na linha da fisioterapeuta, clique em **Comissão**." },
      {
        text: "Escolha **Porcentagem** (do valor de cada aula) ou **Valor fixo** (em reais por aula dada ou falta paga) e digite o valor.",
      },
      {
        text: "Clique em **Salvar comissão**.",
        tip: "A nova comissão vale para as aulas **a partir de agora**. As aulas que já aconteceram continuam com a comissão antiga. Na mesma janela você vê o **Histórico** de alterações.",
      },
    ],
    related: ["comissao-padrao", "pagar-comissao"],
  },
  {
    id: "comissao-padrao",
    category: "comissoes",
    title: "Como definir a comissão padrão da clínica?",
    summary: "É a comissão que já vem preenchida quando você convida uma fisioterapeuta nova.",
    audience: "admin",
    keywords: ["comissão padrão", "padrão", "configurações", "nova fisioterapeuta"],
    steps: [
      { text: "No menu, clique em **Configurações**." },
      { text: "Em **Comissão padrão**, escolha **Porcentagem** ou **Valor fixo** e digite o valor." },
      {
        text: "Clique em **Salvar comissão padrão**.",
        tip: "Isso não muda a comissão de quem já está na equipe. Para essas, use **Equipe > Comissão**.",
      },
    ],
    related: ["alterar-comissao", "convidar-fisioterapeuta"],
  },
  {
    id: "minha-producao",
    category: "comissoes",
    title: "Como ver a minha produção e a minha comissão?",
    summary: "Acompanhe quanto você produziu no mês e quanto tem a receber.",
    audience: "all",
    keywords: ["minha produção", "minha comissão", "quanto vou receber", "produção", "excel", "planilha"],
    steps: [
      {
        text: "No **Dashboard** (a primeira tela), o cartão **Minha Produção Mês** mostra quanto você produziu no mês. O gráfico **Minha Produção Financeira** mostra os últimos meses.",
      },
      {
        text: "Para os detalhes, vá em **Financeiro > Comissões** e escolha o período. Você vê suas **Aulas**, **Faltas pagas**, o **Bruto**, o que **Já foi pago** e o que está **A pagar**.",
      },
      {
        text: "Clique em **Exportar EXCEL** para baixar a sua planilha, aula por aula.",
        tip: "Você vê só a sua produção. Os números das colegas e da clínica ficam com a administração.",
      },
    ],
  },

  // ── Equipe ──────────────────────────────────────────────────────────────────
  {
    id: "convidar-fisioterapeuta",
    category: "equipe",
    title: "Como colocar uma fisioterapeuta nova no sistema?",
    summary: "Convide a fisioterapeuta pelo e-mail dela e defina a comissão.",
    audience: "admin",
    keywords: ["convidar", "convite", "nova fisioterapeuta", "cadastrar fisioterapeuta", "acesso", "equipe", "funcionária"],
    steps: [
      { text: "No menu, clique em **Equipe**." },
      {
        text: "Em **Convidar fisioterapeuta**, escreva o nome e o e-mail dela e confira a **Comissão desta fisioterapeuta**. Clique em **Convidar**.",
      },
      {
        text: "Avise a fisioterapeuta: o sistema **não manda e-mail sozinho**. Ela precisa criar a conta no sistema usando **exatamente o mesmo e-mail** do convite.",
      },
      {
        text: "Quando ela entrar, aparece a tela **Aceitar convite**. Depois que ela aceitar, o convite aparece como **Aceito** e ela entra na lista de **Profissionais ativos**.",
      },
    ],
    related: ["alterar-comissao", "inativar-fisioterapeuta"],
  },
  {
    id: "inativar-fisioterapeuta",
    category: "equipe",
    title: "O que fazer quando uma fisioterapeuta sai da clínica?",
    summary: "Desative o acesso dela sem perder o histórico de atendimentos.",
    audience: "admin",
    keywords: ["inativar", "desativar", "saiu", "demitida", "remover", "excluir fisioterapeuta", "transferir pacientes", "bloquear acesso"],
    steps: [
      { text: "No menu, clique em **Equipe**." },
      { text: "Na linha da fisioterapeuta, clique em **Inativar**." },
      {
        text: "O sistema mostra o que ainda está com ela: **agendamentos futuros**, **pacientes sob responsabilidade** e **pacotes ativos**. Em **Transferir para**, escolha quem vai assumir.",
        tip: "Se escolher **Não transferir**, os itens continuam no nome dela e precisam ser trocados à mão, na agenda e no cadastro dos pacientes.",
      },
      {
        text: "Clique em **Inativar acesso**. Ela perde o acesso na hora. As aulas que ela já deu, as evoluções e as comissões continuam no histórico com o nome dela.",
      },
      { text: "Se ela voltar, é só clicar em **Reativar**, na lista de **Profissionais inativos**." },
    ],
    related: ["convidar-fisioterapeuta"],
  },

  // ── WhatsApp e atestados ────────────────────────────────────────────────────
  {
    id: "whatsapp-confirmar-cobrar",
    category: "whatsapp-atestados",
    title: "Como confirmar aula ou cobrar pelo WhatsApp?",
    summary: "Abra o WhatsApp com a mensagem pronta, sem precisar digitar.",
    audience: "admin",
    keywords: ["whatsapp", "confirmar aula", "cobrar", "cobrança", "mensagem", "lembrete", "zap"],
    steps: [
      {
        text: "No computador, deixe o **WhatsApp Web** aberto e conectado no WhatsApp da clínica.",
      },
      { text: "No menu do sistema, clique em **WhatsApp** e procure o paciente em **Buscar paciente ou telefone**." },
      {
        text: "No cartão do paciente, clique em **Confirmar aula** para mandar a confirmação da próxima aula, ou em **Cobrar** para mandar a cobrança da parcela em aberto.",
        tip: "O botão **Cobrar** só fica ativo quando o paciente tem pagamento em aberto.",
      },
      { text: "O WhatsApp abre com a mensagem já escrita. Confira e aperte **enviar**." },
      { text: "Para escrever uma mensagem livre, use **Conversar**." },
    ],
  },
  {
    id: "emitir-atestado",
    category: "whatsapp-atestados",
    title: "Como emitir um atestado?",
    summary: "Gere o atestado de comparecimento ou afastamento, com assinatura e registro profissional.",
    audience: "all",
    keywords: ["atestado", "declaração", "comparecimento", "afastamento", "documento", "imprimir", "crefito"],
    steps: [
      { text: "No menu, clique em **Atestados**." },
      { text: "Em **Paciente**, digite o nome e escolha o paciente. Depois confira a **Fisioterapeuta** e o **Registro profissional**." },
      {
        text: "Escolha o tipo: **Comparecimento** ou **Afastamento**. Preencha as datas, os horários e, se quiser, uma **Observação**.",
      },
      { text: "Confira o documento na **Prévia do documento**, ao lado." },
      {
        text: "Clique em **Imprimir / PDF**. Na janela de impressão, escolha a impressora ou **Salvar como PDF** para mandar ao paciente.",
      },
    ],
    related: ["configurar-clinica"],
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
  {
    id: "esqueci-senha",
    question: "Esqueci a minha senha. O que eu faço?",
    answer:
      "Fale com o suporte do sistema para redefinir a sua senha. Por segurança, ninguém da clínica consegue ver a sua senha.",
    audience: "all",
    keywords: ["senha", "esqueci", "login", "entrar", "acesso"],
  },
  {
    id: "fisio-marcar-presenca",
    question: "Por que a fisioterapeuta não consegue marcar presença ou falta?",
    answer:
      "Para manter a agenda e o financeiro organizados, quem marca presença, falta, reposição e muda aulas é a administração. A fisioterapeuta vê a agenda, escreve evoluções e faz avaliações.",
    audience: "all",
    keywords: ["presença", "falta", "fisioterapeuta", "permissão", "agenda", "não consigo"],
  },
  {
    id: "horario-lotado",
    question: "O que quer dizer \"Horário lotado\"?",
    answer:
      "Cada horário de Pilates tem um número máximo de alunos. Quando a turma já está cheia, o sistema avisa para você escolher outro horário ou outro dia.",
    audience: "all",
    keywords: ["lotado", "lotação", "turma cheia", "vagas", "horário"],
  },
  {
    id: "convite-email",
    question: "O sistema manda e-mail para a fisioterapeuta convidada?",
    answer:
      "Não. Depois de convidar, avise a fisioterapeuta para criar a conta no sistema usando exatamente o mesmo e-mail do convite.",
    audience: "admin",
    keywords: ["convite", "e-mail", "email", "nova fisioterapeuta"],
  },
  {
    id: "ditado-nao-funciona",
    question: "O ditado por voz não funciona. E agora?",
    answer:
      "Use o navegador **Chrome** ou **Edge** e permita o uso do microfone quando o navegador perguntar. Em outros navegadores, digite a evolução normalmente.",
    audience: "all",
    keywords: ["ditado", "voz", "microfone", "não funciona", "falar"],
  },
  {
    id: "inativar-perde-historico",
    question: "Se eu inativar uma fisioterapeuta, perco os atendimentos dela?",
    answer:
      "Não. Ela só perde o acesso ao sistema. As aulas que ela deu, as evoluções, as avaliações e as comissões continuam guardadas com o nome dela.",
    audience: "admin",
    keywords: ["inativar", "histórico", "saiu", "perder", "dados"],
  },
  {
    id: "dados-seguros",
    question: "Os dados dos pacientes ficam seguros?",
    answer:
      "Sim. Cada clínica só enxerga os próprios dados, cada pessoa vê só o que o perfil dela permite, e os exames anexados abrem por um link que expira.",
    audience: "all",
    keywords: ["segurança", "privacidade", "dados", "lgpd", "sigilo"],
  },
];
