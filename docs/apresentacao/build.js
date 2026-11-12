// Gera FisioOne_Apresentacao.pptx
// Prints: coloque PNG/JPG em ./prints com os nomes de PRINTS abaixo e rode de novo.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");
// apply_theme.js grava as cores da marca no tema do .pptx. Defina
// APPLY_THEME_JS com o caminho dele; sem ele, o arquivo sai com a paleta
// padrão do Office nas cores de tema (o resto continua igual).
let applyTheme = async () => {
  console.warn("APPLY_THEME_JS não definido: cores do tema não aplicadas.");
};
if (process.env.APPLY_THEME_JS) ({ applyTheme } = require(process.env.APPLY_THEME_JS));

const OUT = path.join(__dirname, "FisioOne_Apresentacao.pptx");
const PRINT_DIR = path.join(__dirname, "prints");

// Mesmas cores do sistema (tailwind brand) + verde-água de apoio
const HEX = {
  navy: "0C4A6E",
  ink: "0F172A",
  sky: "0EA5E9",
  skyDark: "0369A1",
  skyTint: "E0F2FE",
  skyWash: "F0F9FF",
  teal: "14B8A6",
  amber: "F59E0B",
  slate: "64748B",
  line: "CBD5E1",
  white: "FFFFFF",
  waBubble: "DCF8C6",
};

const THEME = {
  name: "FisioOne",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink,
    lt1: HEX.white,
    dk2: HEX.navy,
    lt2: HEX.skyWash,
    accent1: HEX.sky,
    accent2: HEX.teal,
    accent3: HEX.amber,
    accent4: HEX.skyDark,
    accent5: HEX.slate,
    accent6: HEX.skyTint,
    hlink: HEX.skyDark,
    folHlink: HEX.navy,
  },
};

// nome do arquivo em ./prints -> legenda do espaço reservado
const PRINTS = {
  dashboard: "Dashboard (tela inicial)",
  agenda: "Agenda do dia",
  pacientes: "Cadastro do paciente / pacote",
  prontuario: "Prontuário (evolução ou avaliação)",
  financeiro: "Financeiro (visão geral ou recebimentos)",
  whatsapp: "WhatsApp (lista de pacientes)",
  atestados: "Atestados (formulário e prévia)",
  equipe: "Equipe",
};

function findPrint(key) {
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const file = path.join(PRINT_DIR, key + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

const iconCache = new Map();
async function icon(Comp, color) {
  const cacheKey = `${Comp.name}-${color}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + color, size: 256 }),
  );
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const data = "image/png;base64," + buf.toString("base64");
  iconCache.set(cacheKey, data);
  return data;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "FisioOne — Gestão para clínicas de fisioterapia e pilates";
  pres.author = "André Macedo";
  pres.company = "FisioOne";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const W = 13.333;
  const MX = 0.6;

  // ── Layouts ────────────────────────────────────────────────────────────────
  pres.defineSlideMaster({
    title: "FISIO_DARK",
    background: { color: C.text2 },
    objects: [],
  });

  pres.defineSlideMaster({
    title: "FISIO_CONTENT",
    background: { color: C.background1 },
    margin: [0.4, 0.6, 0.6, 0.6],
    objects: [
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: MX, y: 0.4, w: W - 2 * MX, h: 0.8,
            fontSize: 36, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "subtitle",
            type: "body",
            x: MX, y: 1.2, w: W - 2 * MX, h: 0.45,
            fontSize: 16, color: C.accent5, valign: "top", align: "left", margin: 0,
          },
          text: "",
        },
      },
      {
        text: {
          text: "FisioOne",
          options: { x: MX, y: 6.95, w: 3, h: 0.3, fontSize: 10, bold: true, color: C.accent1, margin: 0 },
        },
      },
    ],
    slideNumber: { x: W - MX - 0.6, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
  });

  // ── Componentes ────────────────────────────────────────────────────────────
  let objSeq = 0;
  const oname = (base) => `${base}-${++objSeq}`;

  async function iconTile(slide, Comp, x, y, size = 0.55, bg = C.accent1, fg = HEX.white) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: size, h: size, rectRadius: 0.12,
      fill: { color: bg }, line: { color: bg }, objectName: oname("icon-bg"),
    });
    const pad = size * 0.24;
    slide.addImage({
      data: await icon(Comp, fg), x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad,
      altText: "", objectName: oname("icon"),
    });
  }

  async function iconRow(slide, Comp, x, y, w, title, desc) {
    await iconTile(slide, Comp, x, y + 0.04);
    slide.addText(
      [
        { text: title, options: { bold: true, fontSize: 16, color: C.text2, breakLine: true } },
        { text: desc, options: { fontSize: 14, color: C.accent5 } },
      ],
      { x: x + 0.75, y, w: w - 0.75, h: 0.95, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 2, objectName: oname("row-text") },
    );
  }

  // Moldura de tela: print real se existir, senão espaço reservado
  async function screen(slide, key, x, y, w, h, dark = false) {
    const file = findPrint(key);
    if (file) {
      const meta = await sharp(file).metadata();
      const fitH = (w - 0.2) * (meta.height / meta.width) + 0.46;
      if (fitH < h) {
        y += (h - fitH) / 2;
        h = fitH;
      }
    }
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.1,
      fill: { color: dark ? C.accent4 : C.background2 },
      line: { color: dark ? C.accent1 : C.accent6, width: 1 },
      shadow: { type: "outer", color: "0F172A", opacity: 0.18, blur: 12, offset: 4, angle: 90 },
      objectName: oname("screen-frame"),
    });
    // barra de janela com três "luzes"
    ["F87171", "FBBF24", "34D399"].forEach((c, i) => {
      slide.addShape(pres.shapes.OVAL, {
        x: x + 0.18 + i * 0.18, y: y + 0.14, w: 0.1, h: 0.1,
        fill: { color: c }, line: { color: c }, objectName: oname("dot"),
      });
    });
    const ix = x + 0.1, iy = y + 0.36, iw = w - 0.2, ih = h - 0.46;
    if (file) {
      slide.addImage({
        path: file, x: ix, y: iy, w: iw, h: ih,
        sizing: { type: "contain", w: iw, h: ih },
        altText: `Tela do FisioOne: ${PRINTS[key]}`, objectName: oname(`print-${key}`),
      });
    } else {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: ix, y: iy, w: iw, h: ih,
        fill: { color: dark ? C.text2 : C.background1 },
        line: { color: dark ? C.accent1 : C.accent6, width: 1, dashType: "dash" },
        objectName: oname("print-slot"),
      });
      slide.addText(
        [
          { text: "Espaço para print", options: { bold: true, fontSize: 16, breakLine: true } },
          { text: PRINTS[key], options: { fontSize: 14 } },
        ],
        {
          x: ix, y: iy, w: iw, h: ih, align: "center", valign: "middle", margin: 0,
          color: dark ? C.accent6 : C.accent5, isTextBox: true, objectName: oname("print-slot-text"),
        },
      );
    }
  }

  function content(section, title, subtitle) {
    const s = pres.addSlide({ masterName: "FISIO_CONTENT", sectionTitle: section });
    s.addText(title, { placeholder: "title" });
    if (subtitle) s.addText(subtitle, { placeholder: "subtitle" });
    return s;
  }

  // ── 1. Capa ────────────────────────────────────────────────────────────────
  pres.addSection({ title: "Abertura" });
  {
    const s = pres.addSlide({ masterName: "FISIO_DARK", sectionTitle: "Abertura" });
    await iconTile(s, Fi.FiActivity, MX, 1.35, 0.7, C.accent1);
    s.addText("FisioOne", {
      x: MX, y: 2.2, w: 6, h: 1.1, fontSize: 60, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: "cover-title",
    });
    s.addText("A gestão completa da sua clínica de fisioterapia e pilates", {
      x: MX, y: 3.35, w: 5.6, h: 1.0, fontSize: 22, color: C.accent6, margin: 0, valign: "top", isTextBox: true, objectName: "cover-subtitle",
    });
    s.addText("Agenda · Pacientes · Prontuário · Financeiro · Comissões", {
      x: MX, y: 4.7, w: 5.8, h: 0.4, fontSize: 14, italic: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "cover-modules",
    });
    await screen(s, "dashboard", 6.85, 1.3, 5.9, 4.0, true);
    s.addNotes(
      "Abertura: apresente o FisioOne como um sistema feito especificamente para clínicas de fisioterapia e pilates, não um sistema genérico de consultório. Ele já roda no dia a dia de uma clínica real.",
    );
  }

  // ── 2. A dor ───────────────────────────────────────────────────────────────
  pres.addSection({ title: "Problema e solução" });
  {
    const s = content(
      "Problema e solução",
      "Sua clínica ainda roda no caderno e na planilha?",
      "O dia a dia de quem administra uma clínica de pilates tem muita coisa espalhada",
    );
    const pains = [
      [Fi.FiCalendar, "Agenda difícil de controlar", "Turmas lotadas, reposições anotadas em papel e horários que se perdem."],
      [Fi.FiCreditCard, "Pacotes e parcelas esquecidos", "Difícil saber quem pagou, quem está devendo e quantas aulas restam."],
      [Fi.FiPercent, "Comissão calculada na mão", "Fim de mês fechando planilha atendimento por atendimento."],
      [Fi.FiFileText, "Prontuário espalhado", "Evoluções e avaliações em papel ou em arquivos soltos no computador."],
    ];
    const cw = 5.95, ch = 1.85, gx = 0.23, gy = 0.3;
    for (let i = 0; i < pains.length; i++) {
      const [Ic, t, d] = pains[i];
      const x = MX + (i % 2) * (cw + gx);
      const y = 1.95 + Math.floor(i / 2) * (ch + gy);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cw, h: ch, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: C.accent6, width: 1 }, objectName: oname("pain-card"),
      });
      await iconTile(s, Ic, x + 0.35, y + (ch - 0.6) / 2, 0.6, C.accent3);
      s.addText(
        [
          { text: t, options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } },
          { text: d, options: { fontSize: 14, color: C.accent5 } },
        ],
        { x: x + 1.2, y: y + 0.25, w: cw - 1.5, h: ch - 0.5, valign: "middle", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: oname("pain-text") },
      );
    }
    s.addNotes(
      "Pergunte qual dessas dores a clínica sente mais. Use a resposta para decidir em qual módulo se aprofundar na demonstração.",
    );
  }

  // ── 3. Solução ─────────────────────────────────────────────────────────────
  {
    const s = content(
      "Problema e solução",
      "Tudo da clínica em um só lugar",
      "Acesso pela internet, no computador, tablet ou celular",
    );
    const mods = [
      [Fi.FiCalendar, "Agenda", "Turmas, presença, faltas e reposições"],
      [Fi.FiUsers, "Pacientes", "Cadastro, pacotes e parcelas"],
      [Fi.FiClipboard, "Prontuário", "Evoluções e avaliações de Pilates"],
      [Fi.FiDollarSign, "Financeiro", "Recebimentos, despesas e extrato"],
      [Fi.FiPercent, "Comissões", "Cálculo automático por atendimento"],
      [Fi.FiMessageCircle, "WhatsApp", "Confirmação de aula e cobrança"],
      [Fi.FiFileText, "Atestados", "Prontos para imprimir ou salvar em PDF"],
      [Fi.FiUserCheck, "Equipe", "Acesso por perfil para cada profissional"],
    ];
    const cw = 2.85, ch = 2.0, gx = 0.25, gy = 0.25;
    for (let i = 0; i < mods.length; i++) {
      const [Ic, t, d] = mods[i];
      const x = MX + (i % 4) * (cw + gx);
      const y = 1.95 + Math.floor(i / 4) * (ch + gy);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cw, h: ch, rectRadius: 0.12, fill: { color: C.background1 }, line: { color: C.accent6, width: 1 },
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 8, offset: 2, angle: 90 },
        objectName: oname("module-card"),
      });
      await iconTile(s, Ic, x + 0.3, y + 0.3, 0.6);
      s.addText(
        [
          { text: t, options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } },
          { text: d, options: { fontSize: 14, color: C.accent5 } },
        ],
        { x: x + 0.3, y: y + 1.0, w: cw - 0.5, h: 0.9, valign: "top", margin: 0, isTextBox: true, objectName: oname("module-text") },
      );
    }
    s.addText("Em breve: emissão de nota fiscal de serviço (NFS-e) integrada", {
      x: MX, y: 6.45, w: 8, h: 0.35, fontSize: 12, italic: true, color: C.accent4, margin: 0, isTextBox: true, objectName: "nfse-soon",
    });
    s.addNotes("Visão geral dos módulos. Os próximos slides mostram cada um com a tela real do sistema.");
  }

  // ── 4. Agenda ──────────────────────────────────────────────────────────────
  pres.addSection({ title: "Módulos" });
  {
    const s = content("Módulos", "Agenda feita para o Pilates", "Turmas, pacotes e presença no mesmo calendário");
    const rows = [
      [Fi.FiUsers, "Turmas com limite por horário", "O sistema avisa quando o horário está lotado."],
      [Fi.FiRepeat, "Pacotes geram as aulas sozinhos", "Escolha os dias fixos e as sessões entram na agenda."],
      [Fi.FiCheckCircle, "Presença, falta e reposição", "Tudo registrado na própria aula, com histórico."],
      [Fi.FiFilter, "Cores e filtro por profissional", "Veja o dia da clínica ou só de uma fisioterapeuta."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, ...rows[i].slice(0, 1), MX, 1.95 + i * 1.15, 5.8, rows[i][1], rows[i][2]);
    await screen(s, "agenda", 6.75, 1.95, 5.98, 4.3);
    s.addNotes("Mostre a agenda do dia, a lotação de uma turma e como registrar presença ou falta em um clique.");
  }

  // ── 5. Pacientes ───────────────────────────────────────────────────────────
  {
    const s = content("Módulos", "Pacientes e pacotes sob controle", "Quem está ativo, quantas aulas restam e o que falta pagar");
    await screen(s, "pacientes", MX, 1.95, 5.98, 4.3);
    const rows = [
      [Fi.FiUser, "Cadastro completo", "Dados, contato de emergência e observações rápidas."],
      [Fi.FiLayers, "Pacotes de aulas", "Quantidade de aulas, valor e parcelas com vencimento."],
      [Fi.FiBarChart2, "Aulas feitas e faltas", "Saldo de aulas atualizado a cada atendimento."],
      [Fi.FiAlertCircle, "Situação de cada paciente", "Ativo, pausado ou inadimplente, com filtro."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, rows[i][0], 6.95, 1.95 + i * 1.15, 5.8, rows[i][1], rows[i][2]);
    s.addNotes("Abra um paciente com pacote ativo e mostre as parcelas e o saldo de aulas.");
  }

  // ── 6. Prontuário ──────────────────────────────────────────────────────────
  {
    const s = content("Módulos", "Prontuário eletrônico", "O histórico clínico de cada paciente, organizado e seguro");
    const rows = [
      [Fi.FiEdit3, "Evoluções por atendimento", "Registro de cada sessão com o nome da profissional."],
      [Fi.FiActivity, "Avaliação fisioterapêutica de Pilates", "Postural, testes funcionais, flexibilidade e força."],
      [Fi.FiPaperclip, "Exames e documentos anexados", "Arquivos privados, abertos só por quem tem acesso."],
      [Fi.FiClock, "Histórico completo", "Tudo em ordem cronológica, fácil de consultar."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, rows[i][0], MX, 1.95 + i * 1.15, 5.8, rows[i][1], rows[i][2]);
    await screen(s, "prontuario", 6.75, 1.95, 5.98, 4.3);
    s.addNotes("Mostre uma avaliação de Pilates preenchida e uma evolução recente.");
  }

  // ── 7. Financeiro ──────────────────────────────────────────────────────────
  {
    const s = content("Módulos", "Financeiro claro, sem planilha paralela", "Entradas, saídas e o que está em aberto, em uma tela");
    await screen(s, "financeiro", MX, 1.95, 5.98, 4.3);
    const rows = [
      [Fi.FiTrendingUp, "Recebimentos, despesas e extrato", "Resultado do mês sempre atualizado."],
      [Fi.FiAlertCircle, "Inadimplência à vista", "Parcelas vencidas e em aberto destacadas."],
      [Fi.FiCreditCard, "Cartão e maquininha", "Acompanhe o que ainda vai cair na conta."],
      [Fi.FiPrinter, "Recibos e relatórios em PDF", "Recibo para o paciente e relatório para a gestão."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, rows[i][0], 6.95, 1.95 + i * 1.15, 5.8, rows[i][1], rows[i][2]);
    s.addNotes("Mostre a visão geral do mês e a lista de parcelas em aberto.");
  }

  // ── 8. Comissões ───────────────────────────────────────────────────────────
  {
    const s = content("Módulos", "Comissões calculadas sozinhas", "Do atendimento ao pagamento, sem conta no fim do mês");
    const steps = [
      [Fi.FiCheckCircle, "Atendimento realizado", "A presença é registrada na agenda."],
      [Fi.FiPercent, "Comissão calculada", "O valor entra automaticamente na produção da profissional."],
      [Fi.FiSearch, "Revisão da gestão", "A administração confere antes de pagar."],
      [Fi.FiDownload, "Pagamento e planilha", "Registro do pagamento e exportação para Excel."],
    ];
    const cw = 2.85, gx = 0.25, y = 2.0;
    for (let i = 0; i < steps.length; i++) {
      const [Ic, t, d] = steps[i];
      const x = MX + i * (cw + gx);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cw, h: 2.75, rectRadius: 0.12, fill: { color: C.background2 }, line: { color: C.accent6, width: 1 }, objectName: oname("step-card"),
      });
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6, fill: { color: C.text2 }, line: { color: C.text2 }, objectName: oname("step-num-bg"),
      });
      s.addText(String(i + 1), {
        x: x + 0.3, y: y + 0.3, w: 0.6, h: 0.6, align: "center", valign: "middle", fontSize: 20, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: oname("step-num"),
      });
      await iconTile(s, Ic, x + cw - 0.85, y + 0.33, 0.55, C.accent6, HEX.skyDark);
      s.addText(
        [
          { text: t, options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } },
          { text: d, options: { fontSize: 14, color: C.accent5 } },
        ],
        { x: x + 0.3, y: y + 1.15, w: cw - 0.55, h: 1.45, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: oname("step-text") },
      );
      if (i < steps.length - 1) {
        s.addShape(pres.shapes.RIGHT_ARROW, {
          x: x + cw + 0.02, y: y + 1.25, w: 0.21, h: 0.3, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: oname("step-arrow"),
        });
      }
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: MX, y: 5.15, w: W - 2 * MX, h: 1.15, rectRadius: 0.12, fill: { color: C.accent6 }, line: { color: C.accent6 }, objectName: "commission-callout-bg",
    });
    await iconTile(s, Fi.FiEye, MX + 0.3, 5.42, 0.6);
    s.addText(
      [
        { text: "Cada fisioterapeuta acompanha a própria produção", options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } },
        { text: "Ela vê só a comissão dela. Os números da clínica ficam com a administração.", options: { fontSize: 14, color: C.accent4 } },
      ],
      { x: MX + 1.15, y: 5.27, w: 10.6, h: 0.95, valign: "middle", margin: 0, isTextBox: true, objectName: "commission-callout-text" },
    );
    s.addNotes(
      "Ponto forte na venda: elimina o fechamento manual de comissão e reduz discussão com a equipe, porque cada profissional acompanha a própria produção.",
    );
  }

  // ── 9. WhatsApp e atestados ────────────────────────────────────────────────
  {
    const s = content("Módulos", "WhatsApp e atestados em um clique", "Mensagens e documentos prontos, sem digitar tudo de novo");
    const cw = 5.95, x2 = MX + cw + 0.23;
    const cols = [
      [MX, Fi.FiMessageCircle, C.accent2, "Mensagens prontas no WhatsApp", "whatsapp",
        "Confirmar aula e Cobrar abrem o WhatsApp com nome, data e valor já preenchidos."],
      [x2, Fi.FiFileText, C.accent1, "Atestados profissionais", "atestados",
        "Comparecimento ou afastamento, com CREFITO e assinatura, prontos para imprimir ou salvar em PDF."],
    ];
    for (const [x, Ic, bg, title, key, caption] of cols) {
      await iconTile(s, Ic, x, 1.95, 0.55, bg);
      s.addText(title, {
        x: x + 0.75, y: 1.95, w: cw - 0.75, h: 0.55, fontSize: 18, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true, objectName: oname("half-title"),
      });
      await screen(s, key, x, 2.7, cw, 3.3);
      s.addText(caption, {
        x, y: 6.1, w: cw, h: 0.6, fontSize: 14, color: C.accent5, valign: "top", margin: 0, isTextBox: true, objectName: oname("half-caption"),
      });
    }
    s.addNotes("Mostre o botão Confirmar aula e o botão Cobrar na tela de WhatsApp, e emita um atestado de comparecimento.");
  }

  // ── 10. Dashboard ──────────────────────────────────────────────────────────
  {
    const s = content("Módulos", "A clínica inteira em uma tela", "O painel inicial mostra o que importa hoje");
    await screen(s, "dashboard", MX, 1.95, 7.2, 4.6);
    const rows = [
      [Fi.FiCalendar, "Consultas de hoje", "Quem vem e quando."],
      [Fi.FiDollarSign, "Faturamento do mês", "Quanto entrou até agora."],
      [Fi.FiAlertTriangle, "Inadimplência", "Quanto está em atraso."],
      [Fi.FiGift, "Aniversariantes", "Para não esquecer ninguém."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, rows[i][0], 8.2, 1.95 + i * 1.15, 4.55, rows[i][1], rows[i][2]);
    s.addNotes("Feche a parte de módulos voltando ao painel: é a primeira tela que a dona da clínica vê todo dia.");
  }

  // ── 11. Equipe e segurança ─────────────────────────────────────────────────
  pres.addSection({ title: "Confiança" });
  {
    const s = content("Confiança", "Equipe organizada e dados protegidos", "Cada pessoa vê só o que precisa ver");
    const rows = [
      [Fi.FiUserCheck, "Perfis de acesso", "Administração vê tudo; fisioterapeutas veem a agenda e a própria produção."],
      [Fi.FiMail, "Convite por e-mail", "A profissional cria o acesso dela em poucos minutos."],
      [Fi.FiUserX, "Saída sem perder nada", "Inative o acesso e transfira a agenda; o histórico fica guardado."],
      [Fi.FiLock, "Dados protegidos", "Cada clínica vê só os próprios dados; exames abrem com link temporário."],
    ];
    for (let i = 0; i < rows.length; i++) await iconRow(s, rows[i][0], MX, 1.95 + i * 1.15, 5.8, rows[i][1], rows[i][2]);
    await screen(s, "equipe", 6.75, 1.95, 5.98, 4.3);
    s.addNotes("Reforce segurança e privacidade: dados de saúde exigem cuidado, e cada clínica só enxerga os próprios dados.");
  }

  // ── 12. Como começar ───────────────────────────────────────────────────────
  {
    const s = content("Confiança", "Começar é simples", "Do cadastro ao primeiro atendimento");
    const steps = [
      ["Criar a conta", "Cadastro da clínica com e-mail e senha."],
      ["Configurar a clínica", "Dados, endereço e logo nos documentos."],
      ["Convidar a equipe", "Cada fisioterapeuta recebe o acesso dela."],
      ["Cadastrar pacientes", "Pacotes e aulas já entram na agenda."],
    ];
    const lineY = 2.55;
    s.addShape(pres.shapes.LINE, {
      x: MX + 0.45, y: lineY, w: W - 2 * MX - 0.9 - 2.15, h: 0, line: { color: C.accent1, width: 2 }, objectName: "timeline-line",
    });
    const colW = 3.05;
    for (let i = 0; i < steps.length; i++) {
      const x = MX + i * colW;
      s.addShape(pres.shapes.OVAL, {
        x, y: lineY - 0.45, w: 0.9, h: 0.9, fill: { color: C.accent1 }, line: { color: C.background1, width: 3 }, objectName: oname("tl-dot"),
      });
      s.addText(String(i + 1), {
        x, y: lineY - 0.45, w: 0.9, h: 0.9, align: "center", valign: "middle", fontSize: 24, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: oname("tl-num"),
      });
      s.addText(
        [
          { text: steps[i][0], options: { bold: true, fontSize: 18, color: C.text2, breakLine: true } },
          { text: steps[i][1], options: { fontSize: 14, color: C.accent5 } },
        ],
        { x, y: lineY + 0.7, w: colW - 0.35, h: 1.2, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: oname("tl-text") },
      );
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: MX, y: 4.75, w: W - 2 * MX, h: 1.55, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.text2 }, objectName: "proof-bg",
    });
    await iconTile(s, Fi.FiStar, MX + 0.4, 5.17, 0.7, C.accent3);
    s.addText(
      [
        { text: "Já em uso no dia a dia de uma clínica de fisioterapia e pilates", options: { bold: true, fontSize: 20, color: C.background1, breakLine: true } },
        { text: "Criado e melhorado a partir da rotina real de atendimento, agenda e financeiro.", options: { fontSize: 14, color: C.accent6 } },
      ],
      { x: MX + 1.4, y: 4.9, w: 10.4, h: 1.25, valign: "middle", margin: 0, isTextBox: true, objectName: "proof-text" },
    );
    s.addNotes(
      "Se a clínica cliente autorizar, cite o nome dela e um depoimento curto aqui; prova social ajuda muito a fechar.",
    );
  }

  // ── 13. Fechamento ─────────────────────────────────────────────────────────
  pres.addSection({ title: "Fechamento" });
  {
    const s = pres.addSlide({ masterName: "FISIO_DARK", sectionTitle: "Fechamento" });
    await iconTile(s, Fi.FiActivity, MX, 1.2, 0.7, C.accent1);
    s.addText("Vamos ver o FisioOne funcionando na sua clínica?", {
      x: MX, y: 2.05, w: 6.6, h: 1.8, fontSize: 40, bold: true, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "closing-title",
    });
    s.addText("Agende uma demonstração com os seus horários, seus pacotes e a sua equipe.", {
      x: MX, y: 4.05, w: 6.2, h: 0.9, fontSize: 18, color: C.accent6, valign: "top", margin: 0, isTextBox: true, objectName: "closing-sub",
    });
    const bx = 7.75, by = 1.6, bw = 5.0, bh = 4.1;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: bx, y: by, w: bw, h: bh, rectRadius: 0.15, fill: { color: C.background1 }, line: { color: C.background1 }, objectName: "contact-card",
    });
    s.addText("Fale comigo", {
      x: bx + 0.4, y: by + 0.35, w: bw - 0.8, h: 0.5, fontSize: 22, bold: true, color: C.text2, margin: 0, isTextBox: true, objectName: "contact-title",
    });
    const contacts = [
      [Fi.FiUser, "Nome", "[seu nome]"],
      [Fi.FiPhone, "WhatsApp", "[(65) 9 0000-0000]"],
      [Fi.FiMail, "E-mail", "[seu e-mail]"],
    ];
    for (let i = 0; i < contacts.length; i++) {
      const cy = by + 1.15 + i * 0.9;
      await iconTile(s, contacts[i][0], bx + 0.4, cy, 0.55, C.accent6, HEX.skyDark);
      s.addText(
        [
          { text: contacts[i][1], options: { fontSize: 12, color: C.accent5, breakLine: true } },
          { text: contacts[i][2], options: { fontSize: 16, bold: true, color: C.text2 } },
        ],
        { x: bx + 1.15, y: cy - 0.05, w: bw - 1.5, h: 0.65, valign: "middle", margin: 0, isTextBox: true, objectName: oname("contact-line") },
      );
    }
    s.addNotes("Combine a data da demonstração antes de encerrar a conversa.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  const missing = Object.keys(PRINTS).filter((k) => !findPrint(k));
  console.log("ok:", OUT);
  console.log(missing.length ? "prints faltando: " + missing.join(", ") : "todos os prints inseridos");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
