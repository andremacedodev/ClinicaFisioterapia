/*
  Planilhas de comissão e de produção da administradora (Excel).

  - Administração: aba "Resumo" + uma aba por fisioterapeuta.
  - Fisioterapeuta: só a própria aba.
  - Administradora: aba "Produção", sem nenhuma coluna de comissão.

  Cada aba tem pacientes × dias com lista de opções (PRESENÇA/FALTA), cores,
  cartões de resumo e fórmulas travadas (proteção sem senha: Revisão >
  Desproteger planilha). Os totais, os cartões e o Resumo são fórmulas, então
  corrigir um dia atualiza tudo.

  Este módulo é carregado só na exportação (junto com o exceljs).
*/
import ExcelJS from "exceljs";
import type { CommissionDetailRow, ProfessionalReport } from "./financialCore";

type Worksheet = ExcelJS.Worksheet;
type Fill = ExcelJS.Fill;

export type CommissionWorkbookOptions = {
  mode: "commission" | "admin_production";
  /** Fisioterapeuta exportando a própria planilha: só a aba dela, sem Resumo. */
  ownSheetOnly?: boolean;
  report: ProfessionalReport[];
  detailRows: CommissionDetailRow[];
  startDate: string;
  endDate: string;
  clinicName: string;
};

const PRESENCE = "PRESENÇA";
const ABSENCE = "FALTA";
/** Reposição conta como presença, mas aparece escrita como reposição. */
const MAKEUP = "REPOSIÇÃO";
const MARK_OPTIONS = [
  PRESENCE,
  ABSENCE,
  MAKEUP,
  `${PRESENCE} / ${PRESENCE}`,
  `${PRESENCE} / ${ABSENCE}`,
  `${PRESENCE} / ${MAKEUP}`,
  `${MAKEUP} / ${PRESENCE}`,
  `${ABSENCE} / ${ABSENCE}`,
];

const COLOR = {
  brand: "FF075985",
  brandText: "FF0C4A6E",
  text: "FF0F172A",
  muted: "FF64748B",
  border: "FFCBD5E1",
  zebra: "FFF8FAFC",
  weekend: "FFF1F5F9",
  presenceFill: "FFDCFCE7",
  presenceText: "FF166534",
  makeupFill: "FFEDE9FE",
  makeupText: "FF5B21B6",
  absenceFill: "FFFFEDD5",
  absenceText: "FF9A3412",
  note: "FFFEF9C3",
  total: "FFE2E8F0",
  card: "FFF0F9FF",
  highlight: "FFECFDF5",
  highlightText: "FF047857",
  formula: "FFF5FAFF",
  formulaZebra: "FFEFF6FF",
  white: "FFFFFFFF",
};
const MONEY = '"R$" #,##0.00';
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const thin = { style: "thin" as const, color: { argb: COLOR.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
// Em formatação condicional o Excel lê a cor de fundo em bgColor.
const conditionalFill = (argb: string): Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
  bgColor: { argb },
});
const PAGE_SETUP: Partial<ExcelJS.PageSetup> = {
  orientation: "landscape",
  paperSize: 9,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
};

function columnLetter(index: number): string {
  let letters = "";
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const cellRef = (column: number, row: number) => `${columnLetter(column)}${row}`;

function listDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cursor <= end) {
    days.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const formatDate = (iso: string) => iso.split("-").reverse().join("/");

/** "setembro/2026" quando o período é um mês; senão "01/09/2026 a 15/09/2026". */
export function periodLabel(startDate: string, endDate: string): string {
  const [year, month] = startDate.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const isWholeMonth =
    startDate.endsWith("-01") &&
    endDate === `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return isWholeMonth
    ? `${MONTHS[month - 1]}/${year}`
    : `${formatDate(startDate)} a ${formatDate(endDate)}`;
}

/** Nome de aba válido no Excel (até 31 caracteres, sem : \ / ? * [ ]) e único. */
function sheetNameFor(name: string, used: Set<string>): string {
  const base = (name.replace(/[:\\/?*[\]]/g, " ").trim() || "Fisioterapeuta").slice(0, 31);
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;

/** Conta ocorrências (duas aulas no mesmo dia contam duas vezes). */
function countFormula(range: string, word: string): string {
  return `SUMPRODUCT((LEN(${range})-LEN(SUBSTITUTE(${range},"${word}","")))/LEN("${word}"))`;
}

function countMarks(marks: string[], word: string): number {
  return marks.reduce((total, mark) => total + mark.split(word).length - 1, 0);
}

function titleBlock(ws: Worksheet, title: string, subtitle: string, lastColumn: number) {
  ws.mergeCells(1, 1, 1, lastColumn);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: COLOR.brandText } };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { size: 11, color: { argb: COLOR.muted } };
}

function noteBlock(ws: Worksheet, row: number, text: string, lastColumn: number) {
  ws.mergeCells(row, 1, row, lastColumn);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.fill = solid(COLOR.note);
  cell.font = { size: 10, color: { argb: COLOR.text } };
  cell.alignment = { wrapText: true, vertical: "middle", indent: 1 };
  cell.border = box;
  ws.getRow(row).height = 34;
}

type Card = {
  label: string;
  value: ExcelJS.CellValue;
  money?: boolean;
  highlight?: boolean;
  editable?: boolean;
};

function cardRow(ws: Worksheet, row: number, cards: Card[]) {
  cards.forEach((card, index) => {
    const first = 1 + index * 2;
    ws.mergeCells(row, first, row, first + 1);
    ws.mergeCells(row + 1, first, row + 1, first + 1);
    const background = card.highlight ? COLOR.highlight : COLOR.card;
    const label = ws.getCell(row, first);
    label.value = card.label;
    label.font = { size: 9, bold: true, color: { argb: COLOR.muted } };
    label.fill = solid(background);
    label.alignment = { indent: 1, vertical: "bottom" };
    const value = ws.getCell(row + 1, first);
    value.value = card.value;
    value.numFmt = card.money ? MONEY : "0";
    value.font = {
      size: 14,
      bold: true,
      color: { argb: card.highlight ? COLOR.highlightText : COLOR.brandText },
    };
    value.fill = solid(background);
    value.alignment = { indent: 1, vertical: "middle", horizontal: "left" };
    if (card.editable) value.protection = { locked: false };
    for (const r of [row, row + 1]) {
      for (const c of [first, first + 1]) {
        ws.getCell(r, c).border = {
          top: r === row ? thin : undefined,
          bottom: r === row + 1 ? thin : undefined,
          left: c === first ? thin : undefined,
          right: c === first + 1 ? thin : undefined,
        };
      }
    }
  });
  ws.getRow(row).height = 18;
  ws.getRow(row + 1).height = 26;
}

type Patient = {
  name: string;
  packageAmount: number;
  classValue: number;
  commissionValue: number;
  contractedLessons: number;
  marks: Record<string, string>;
};

type GridResult = {
  sheetName: string;
  totalRow: number;
  columns: { presences: number; absences: number; paid: number; gross: number; commission: number };
  totals: { presences: number; absences: number; paid: number; gross: number; commission: number };
};

function gridSheet(
  wb: ExcelJS.Workbook,
  options: {
    sheetName: string;
    title: string;
    subtitle: string;
    days: string[];
    patients: Patient[];
    withCommission: boolean;
    alreadyPaid: number;
  },
): GridResult {
  const { sheetName, title, subtitle, days, patients, withCommission, alreadyPaid } = options;
  const ws = wb.addWorksheet(sheetName, { pageSetup: PAGE_SETUP });

  const fixedHeaders = withCommission
    ? ["Paciente", "Valor do pacote", "Valor da aula", "Comissão por aula", "Aulas do pacote"]
    : ["Paciente", "Valor do pacote", "Valor da aula", "Aulas do pacote"];
  const fixedWidths = withCommission ? [28, 14, 12, 13, 10] : [28, 14, 12, 10];
  const moneyFixedColumns = withCommission ? [2, 3, 4] : [2, 3];
  const valueColumn = 3;
  const commissionValueColumn = withCommission ? 4 : 0;
  const firstDayColumn = fixedHeaders.length + 1;
  const lastDayColumn = firstDayColumn + days.length - 1;
  const tailHeaders = withCommission
    ? ["Presenças", "Faltas pagas", "Aulas pagas", "Total bruto", "Comissão"]
    : ["Presenças", "Faltas pagas", "Aulas pagas", "Total produzido"];
  const columns = {
    presences: lastDayColumn + 1,
    absences: lastDayColumn + 2,
    paid: lastDayColumn + 3,
    gross: lastDayColumn + 4,
    commission: withCommission ? lastDayColumn + 5 : 0,
  };
  const lastColumn = lastDayColumn + tailHeaders.length;

  const headerRow = 9;
  const firstRow = headerRow + 1;
  // Sem pacientes, mantém uma linha vazia para as fórmulas continuarem válidas.
  const rows: Patient[] = patients.length
    ? patients
    : [{ name: "Nenhuma aula no período", packageAmount: 0, classValue: 0, commissionValue: 0, contractedLessons: 0, marks: {} }];
  const lastRow = firstRow + rows.length - 1;
  const totalRow = lastRow + 1;

  titleBlock(ws, title, subtitle, Math.min(lastColumn, 14));

  // valores calculados aqui só para exibir antes do Excel recalcular
  const rowValues = rows.map((patient) => {
    const marks = Object.values(patient.marks);
    const presences = countMarks(marks, PRESENCE) + countMarks(marks, MAKEUP);
    const absences = countMarks(marks, ABSENCE);
    const paid = presences + absences;
    return {
      presences,
      absences,
      paid,
      gross: paid * patient.classValue,
      commission: paid * patient.commissionValue,
    };
  });
  const totals = rowValues.reduce(
    (acc, value) => ({
      presences: acc.presences + value.presences,
      absences: acc.absences + value.absences,
      paid: acc.paid + value.paid,
      gross: acc.gross + value.gross,
      commission: acc.commission + value.commission,
    }),
    { presences: 0, absences: 0, paid: 0, gross: 0, commission: 0 },
  );

  const totalRef = (column: number) => cellRef(column, totalRow);
  const cards: Card[] = withCommission
    ? [
        { label: "AULAS PAGAS", value: { formula: totalRef(columns.paid), result: totals.paid } },
        { label: "TOTAL BRUTO", value: { formula: totalRef(columns.gross), result: totals.gross }, money: true },
        { label: "COMISSÃO DO PERÍODO", value: { formula: totalRef(columns.commission), result: totals.commission }, money: true },
        { label: "JÁ PAGO", value: alreadyPaid, money: true, editable: true },
        {
          label: "A PAGAR",
          value: {
            formula: `MAX(0,${totalRef(columns.commission)}-${cellRef(7, 5)})`,
            result: Math.max(0, totals.commission - alreadyPaid),
          },
          money: true,
          highlight: true,
        },
      ]
    : [
        { label: "PRESENÇAS", value: { formula: totalRef(columns.presences), result: totals.presences } },
        { label: "FALTAS PAGAS", value: { formula: totalRef(columns.absences), result: totals.absences } },
        { label: "AULAS PAGAS", value: { formula: totalRef(columns.paid), result: totals.paid } },
        { label: "TOTAL PRODUZIDO", value: { formula: totalRef(columns.gross), result: totals.gross }, money: true, highlight: true },
      ];
  cardRow(ws, 4, cards);

  noteBlock(
    ws,
    7,
    "Como usar: clique na célula do dia e escolha PRESENÇA, REPOSIÇÃO ou FALTA na setinha da lista. " +
      "Reposição conta como presença. Presenças e faltas pagas contam como aula paga. " +
      "Os totais e os cartões acima se atualizam sozinhos. Colunas cinzas = fim de semana.",
    Math.min(lastColumn, 22),
  );

  const header = ws.getRow(headerRow);
  const dayHeaders = days.map((day) => {
    const date = new Date(`${day}T12:00:00`);
    return `${String(date.getDate()).padStart(2, "0")}\n${WEEKDAYS[date.getDay()]}`;
  });
  [...fixedHeaders, ...dayHeaders, ...tailHeaders].forEach((text, index) => {
    const cell = header.getCell(index + 1);
    cell.value = text;
    cell.font = { bold: true, size: 9, color: { argb: COLOR.white } };
    cell.fill = solid(COLOR.brand);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = box;
  });
  header.height = 32;

  const weekend = days.map((day) => {
    const weekday = new Date(`${day}T12:00:00`).getDay();
    return weekday === 0 || weekday === 6;
  });

  rows.forEach((patient, index) => {
    const r = firstRow + index;
    const row = ws.getRow(r);
    const zebra = index % 2 === 1;
    const fixedValues = withCommission
      ? [patient.name, patient.packageAmount, patient.classValue, patient.commissionValue, patient.contractedLessons]
      : [patient.name, patient.packageAmount, patient.classValue, patient.contractedLessons];

    fixedValues.forEach((value, i) => {
      const column = i + 1;
      const cell = row.getCell(column);
      cell.value = value;
      if (moneyFixedColumns.includes(column)) cell.numFmt = MONEY;
      cell.alignment = { horizontal: column === 1 ? "left" : "center", vertical: "middle", indent: column === 1 ? 1 : 0 };
      if (zebra) cell.fill = solid(COLOR.zebra);
      cell.border = box;
    });
    row.getCell(1).font = { bold: true, color: { argb: COLOR.text } };
    // valores que a pessoa pode ajustar
    [1, 2, valueColumn, commissionValueColumn]
      .filter(Boolean)
      .forEach((column) => { row.getCell(column).protection = { locked: false }; });

    days.forEach((day, i) => {
      const cell = row.getCell(firstDayColumn + i);
      cell.value = patient.marks[day] ?? null;
      cell.alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
      cell.font = { size: 7, bold: true };
      cell.border = box;
      cell.protection = { locked: false };
      if (weekend[i]) cell.fill = solid(COLOR.weekend);
      else if (zebra) cell.fill = solid(COLOR.zebra);
    });

    const range = `${cellRef(firstDayColumn, r)}:${cellRef(lastDayColumn, r)}`;
    const values = rowValues[index];
    const formulas: Array<[number, ExcelJS.CellFormulaValue, string]> = [
      [
        columns.presences,
        {
          formula: `${countFormula(range, PRESENCE)}+${countFormula(range, MAKEUP)}`,
          result: values.presences,
        },
        "0",
      ],
      [columns.absences, { formula: countFormula(range, ABSENCE), result: values.absences }, "0"],
      [columns.paid, { formula: `${cellRef(columns.presences, r)}+${cellRef(columns.absences, r)}`, result: values.paid }, "0"],
      [columns.gross, { formula: `${cellRef(columns.paid, r)}*${cellRef(valueColumn, r)}`, result: values.gross }, MONEY],
    ];
    if (withCommission) {
      formulas.push([
        columns.commission,
        { formula: `${cellRef(columns.paid, r)}*${cellRef(commissionValueColumn, r)}`, result: values.commission },
        MONEY,
      ]);
    }
    const emphasized = withCommission ? columns.commission : columns.gross;
    formulas.forEach(([column, value, format]) => {
      const cell = row.getCell(column);
      cell.value = value;
      cell.numFmt = format;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = solid(zebra ? COLOR.formulaZebra : COLOR.formula);
      cell.font = { bold: column === emphasized };
      cell.border = box;
    });
    row.height = 20;
  });

  const total = ws.getRow(totalRow);
  total.getCell(1).value = "TOTAL";
  for (let column = 1; column <= lastColumn; column++) {
    const cell = total.getCell(column);
    cell.fill = solid(COLOR.total);
    cell.border = box;
    cell.font = { bold: true };
    cell.alignment = { horizontal: column === 1 ? "left" : "center", vertical: "middle", indent: column === 1 ? 1 : 0 };
  }
  const sums: Array<[number, number, boolean]> = [
    [columns.presences, totals.presences, false],
    [columns.absences, totals.absences, false],
    [columns.paid, totals.paid, false],
    [columns.gross, totals.gross, true],
  ];
  if (withCommission) sums.push([columns.commission, totals.commission, true]);
  sums.forEach(([column, result, money]) => {
    const cell = total.getCell(column);
    cell.value = { formula: `SUM(${cellRef(column, firstRow)}:${cellRef(column, lastRow)})`, result };
    cell.numFmt = money ? MONEY : "0";
  });
  total.height = 22;

  const gridRange = `${cellRef(firstDayColumn, firstRow)}:${cellRef(lastDayColumn, lastRow)}`;
  const firstGridCell = cellRef(firstDayColumn, firstRow);
  // dataValidations existe no exceljs, mas não está na definição de tipos dele.
  (ws as unknown as {
    dataValidations: { add: (range: string, validation: ExcelJS.DataValidation) => void };
  }).dataValidations.add(gridRange, {
    type: "list",
    allowBlank: true,
    formulae: [`"${MARK_OPTIONS.join(",")}"`],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Valor inválido",
    error: "Escolha PRESENÇA, REPOSIÇÃO ou FALTA na lista (ou deixe em branco).",
  });
  ws.addConditionalFormatting({
    ref: gridRange,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`NOT(ISERROR(SEARCH("${ABSENCE}",${firstGridCell})))`],
        style: { fill: conditionalFill(COLOR.absenceFill), font: { color: { argb: COLOR.absenceText }, bold: true } },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [`NOT(ISERROR(SEARCH("${MAKEUP}",${firstGridCell})))`],
        style: { fill: conditionalFill(COLOR.makeupFill), font: { color: { argb: COLOR.makeupText }, bold: true } },
      },
      {
        type: "expression",
        priority: 3,
        formulae: [`NOT(ISERROR(SEARCH("${PRESENCE}",${firstGridCell})))`],
        style: { fill: conditionalFill(COLOR.presenceFill), font: { color: { argb: COLOR.presenceText }, bold: true } },
      },
    ],
  });

  fixedWidths.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  for (let column = firstDayColumn; column <= lastDayColumn; column++) ws.getColumn(column).width = 7.5;
  tailHeaders.forEach((_, i) => { ws.getColumn(columns.presences + i).width = i >= 3 ? 15 : 10; });
  ws.views = [{ state: "frozen", xSplit: fixedHeaders.length, ySplit: headerRow, showGridLines: false }];
  void ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true,
  });

  return { sheetName, totalRow, columns, totals };
}

function summarySheet(
  ws: Worksheet,
  entries: Array<{ name: string; alreadyPaid: number; grid: GridResult }>,
  title: string,
  subtitle: string,
) {
  const headers = ["Fisioterapeuta", "Presenças", "Faltas pagas", "Aulas pagas", "Total bruto", "Comissão do período", "Já pago", "A pagar"];
  titleBlock(ws, title, subtitle, headers.length);
  noteBlock(
    ws,
    4,
    "Tudo aqui é calculado a partir da aba de cada fisioterapeuta (abas lá embaixo; clique no nome para abrir). " +
      "Para corrigir uma aula, abra a aba dela e altere o dia. \"Já pago\" vem do sistema.",
    headers.length,
  );

  const header = ws.getRow(6);
  headers.forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true, color: { argb: COLOR.white } };
    cell.fill = solid(COLOR.brand);
    cell.alignment = { horizontal: i ? "center" : "left", vertical: "middle", indent: i ? 0 : 1, wrapText: true };
    cell.border = box;
  });
  header.height = 30;

  const first = 7;
  entries.forEach(({ name, alreadyPaid, grid }, index) => {
    const r = first + index;
    const row = ws.getRow(r);
    const sheet = quoteSheet(grid.sheetName);
    const link = (column: number, result: number) => ({
      formula: `${sheet}!${cellRef(column, grid.totalRow)}`,
      result,
    });
    const values: ExcelJS.CellValue[] = [
      { text: name, hyperlink: `#${sheet}!A1` },
      link(grid.columns.presences, grid.totals.presences),
      link(grid.columns.absences, grid.totals.absences),
      link(grid.columns.paid, grid.totals.paid),
      link(grid.columns.gross, grid.totals.gross),
      link(grid.columns.commission, grid.totals.commission),
      alreadyPaid,
      { formula: `MAX(0,F${r}-G${r})`, result: Math.max(0, grid.totals.commission - alreadyPaid) },
    ];
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.border = box;
      cell.numFmt = i >= 4 ? MONEY : "0";
      cell.alignment = { horizontal: i ? "center" : "left", vertical: "middle", indent: i ? 0 : 1 };
      if (index % 2) cell.fill = solid(COLOR.zebra);
    });
    row.getCell(1).font = { bold: true, underline: true, color: { argb: COLOR.brand } };
    row.getCell(8).font = { bold: true, color: { argb: COLOR.highlightText } };
    row.height = 22;
  });

  const last = first + Math.max(entries.length, 1) - 1;
  const total = ws.getRow(last + 1);
  total.getCell(1).value = "TOTAL";
  const results = [
    0,
    entries.reduce((t, e) => t + e.grid.totals.presences, 0),
    entries.reduce((t, e) => t + e.grid.totals.absences, 0),
    entries.reduce((t, e) => t + e.grid.totals.paid, 0),
    entries.reduce((t, e) => t + e.grid.totals.gross, 0),
    entries.reduce((t, e) => t + e.grid.totals.commission, 0),
    entries.reduce((t, e) => t + e.alreadyPaid, 0),
    entries.reduce((t, e) => t + Math.max(0, e.grid.totals.commission - e.alreadyPaid), 0),
  ];
  for (let column = 1; column <= headers.length; column++) {
    const cell = total.getCell(column);
    cell.fill = solid(COLOR.total);
    cell.border = box;
    cell.font = { bold: true };
    cell.alignment = { horizontal: column === 1 ? "left" : "center", vertical: "middle", indent: column === 1 ? 1 : 0 };
    if (column > 1) {
      cell.value = { formula: `SUM(${cellRef(column, first)}:${cellRef(column, last)})`, result: results[column - 1] };
      cell.numFmt = column >= 5 ? MONEY : "0";
    }
  }
  total.height = 24;
  [28, 12, 13, 13, 16, 17, 14, 16].forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  ws.views = [{ showGridLines: false }];
}

function patientsFor(rows: CommissionDetailRow[]): Patient[] {
  return [...rows]
    .sort((a, b) => a.patientName.localeCompare(b.patientName))
    .map((row) => ({
      name: row.patientName,
      packageAmount: row.packageAmount,
      classValue: row.grossClassValue,
      commissionValue: row.commissionClassValue,
      contractedLessons: row.contractedLessons,
      marks: Object.fromEntries(
        Object.entries(row.attendanceByDate).map(([day, marks]) => [day, marks.join(" / ")]),
      ),
    }));
}

export async function buildCommissionWorkbook(options: CommissionWorkbookOptions): Promise<Blob> {
  const { mode, report, detailRows, startDate, endDate, clinicName } = options;
  const days = listDays(startDate, endDate);
  const period = periodLabel(startDate, endDate);
  const subtitle = `${clinicName} · ${formatDate(startDate)} a ${formatDate(endDate)}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = clinicName;
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  // Fisioterapeutas do período: as do relatório e as que têm linhas detalhadas.
  const professionals = new Map<string, { name: string; alreadyPaid: number }>();
  report.forEach((item) =>
    professionals.set(item.professionalId, { name: item.professionalName, alreadyPaid: item.commissionPaid }),
  );
  detailRows.forEach((row) => {
    if (!professionals.has(row.professionalId)) {
      professionals.set(row.professionalId, { name: row.professionalName, alreadyPaid: 0 });
    }
  });
  const ordered = [...professionals.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  if (mode === "admin_production") {
    const [id, info] = ordered[0] ?? ["", { name: "Administradora", alreadyPaid: 0 }];
    gridSheet(wb, {
      sheetName: "Produção",
      title: `${info.name} · produção de ${period}`,
      subtitle: `${subtitle} · administradora (sem comissão)`,
      days,
      patients: patientsFor(detailRows.filter((row) => row.professionalId === id)),
      withCommission: false,
      alreadyPaid: 0,
    });
  } else {
    const summary = options.ownSheetOnly
      ? null
      : wb.addWorksheet("Resumo", { pageSetup: PAGE_SETUP });
    const usedNames = new Set<string>(["resumo"]);
    const entries = ordered.map(([id, info]) => ({
      name: info.name,
      alreadyPaid: info.alreadyPaid,
      grid: gridSheet(wb, {
        sheetName: sheetNameFor(info.name, usedNames),
        title: `${info.name} · comissão de ${period}`,
        subtitle,
        days,
        patients: patientsFor(detailRows.filter((row) => row.professionalId === id)),
        withCommission: true,
        alreadyPaid: info.alreadyPaid,
      }),
    }));
    if (summary) {
      summarySheet(summary, entries, `Comissões de ${period}`, `${subtitle} · gerado em ${new Date().toLocaleDateString("pt-BR")}`);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
