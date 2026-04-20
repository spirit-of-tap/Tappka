import type ExcelJS from 'exceljs';
import type { PortfolioEsejeRow } from './types';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';

const TAP_RED = 'FFB31B1B';
const TAP_WHITE = 'FFFCFFF7';
const LIGHT_RED = 'FFFDECEA';
const GRAY_ROW = 'FFF5F5F5';
const BORDER_COLOR = 'FFD0D0D0';

const ALL_CATEGORIES = Object.values(BOOK_CATEGORY_LABELS);

interface Stats {
  approvedPoints: number;
  pendingPoints: number;
  essayCount: number;
}

function thin(color = BORDER_COLOR): ExcelJS.Border {
  return { style: 'thin', color: { argb: color } };
}

function redCell(ws: ExcelJS.Worksheet, address: string, value: string | number, opts?: {
  size?: number; white?: boolean; bold?: boolean; align?: ExcelJS.Alignment['horizontal'];
}) {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TAP_RED } };
  cell.font = {
    bold: opts?.bold ?? true,
    color: { argb: opts?.white ?? true ? 'FFFFFFFF' : TAP_WHITE },
    name: 'Calibri',
    size: opts?.size ?? 11,
  };
  cell.alignment = { vertical: 'middle', horizontal: opts?.align ?? 'left', wrapText: false };
  return cell;
}

function labelCell(ws: ExcelJS.Worksheet, address: string, value: string | number, bold = false) {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.font = { name: 'Calibri', size: 10, bold };
  cell.alignment = { vertical: 'middle' };
  return cell;
}

function valueCell(ws: ExcelJS.Worksheet, address: string, value: string | number) {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1A1A1A' } };
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
  return cell;
}

function borderedBlock(ws: ExcelJS.Worksheet, startRow: number, endRow: number, cols: number[]) {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      const cell = ws.getRow(r).getCell(c);
      const isFirst = r === startRow;
      const isLast = r === endRow;
      cell.border = {
        top: isFirst ? thin('FF999999') : undefined,
        bottom: isLast ? thin('FF999999') : undefined,
        left: c === cols[0] ? thin('FF999999') : thin(),
        right: c === cols[cols.length - 1] ? thin('FF999999') : thin(),
      };
    }
  }
}

export async function buildEsejeSheet(
  wb: ExcelJS.Workbook,
  rows: PortfolioEsejeRow[],
  stats: Stats,
): Promise<void> {
  // Remove existing Eseje sheet if present
  const existing = wb.getWorksheet('Eseje');
  if (existing) wb.removeWorksheet(existing.id);

  const ws = wb.addWorksheet('Eseje', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    properties: { defaultColWidth: 14 },
  });

  // ── Column widths ──
  ws.getColumn(1).width = 6;   // #
  ws.getColumn(2).width = 34;  // Název knihy
  ws.getColumn(3).width = 24;  // Autor
  ws.getColumn(4).width = 12;  // Odkaz
  ws.getColumn(5).width = 20;  // Kategorie
  ws.getColumn(6).width = 12;  // Zdroj
  ws.getColumn(7).width = 10;  // Body

  // ── Row 1: Tappka brand header ──
  ws.mergeCells('B1:G1');
  const titleCell = ws.getCell('B1');
  titleCell.value = 'Eseje';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TAP_RED } };
  titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 32;

  // Tappka label in A1
  const brandCell = ws.getCell('A1');
  brandCell.value = 'T';
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TAP_RED } };
  brandCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // ── Row 2: subtitle ──
  ws.mergeCells('A2:G2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `Generováno z Tappka · ${new Date().toLocaleDateString('cs-CZ')}`;
  subtitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF888888' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 16;

  // ── Row 3: spacer ──
  ws.getRow(3).height = 6;

  // ── Rows 4-5: Stats ──
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 18;
  ws.getRow(6).height = 18;

  // Stats labels
  ws.mergeCells('B4:C4');
  labelCell(ws, 'B4', 'Počet bodů CELKEM', true);
  valueCell(ws, 'D4', stats.approvedPoints);

  ws.mergeCells('B5:C5');
  labelCell(ws, 'B5', 'Počet bodů z knih');
  valueCell(ws, 'D5', rows.length);

  ws.mergeCells('B6:C6');
  labelCell(ws, 'B6', 'Počet mimoknižních bodů');
  valueCell(ws, 'D6', 0);

  // Goals (right side)
  const year1Remaining = Math.max(0, 40 - stats.approvedPoints);
  const year2Remaining = Math.max(0, 80 - stats.approvedPoints);
  const totalRemaining = Math.max(0, 120 - stats.approvedPoints);

  ws.mergeCells('E4:F4');
  labelCell(ws, 'E4', 'Do konce 1. ročníku zbývá (40 KB)');
  const g4 = ws.getCell('G4');
  g4.value = year1Remaining;
  g4.font = { name: 'Calibri', size: 10, bold: true, color: { argb: year1Remaining === 0 ? 'FF34A853' : 'FFCC0000' } };
  g4.alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells('E5:F5');
  labelCell(ws, 'E5', 'Do konce 2. ročníku zbývá (80 KB)');
  const g5 = ws.getCell('G5');
  g5.value = year2Remaining;
  g5.font = { name: 'Calibri', size: 10, bold: true, color: { argb: year2Remaining === 0 ? 'FF34A853' : 'FFCC0000' } };
  g5.alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells('E6:F6');
  labelCell(ws, 'E6', 'Do konce studia zbývá (120 KB)');
  const g6 = ws.getCell('G6');
  g6.value = totalRemaining;
  g6.font = { name: 'Calibri', size: 10, bold: true, color: { argb: totalRemaining === 0 ? 'FF34A853' : 'FFCC0000' } };
  g6.alignment = { horizontal: 'right', vertical: 'middle' };

  borderedBlock(ws, 4, 6, [2, 3, 4, 5, 6, 7]);

  // ── Row 7: spacer ──
  ws.getRow(7).height = 6;

  // ── Rows 8+: Category breakdown ──
  ws.mergeCells('B8:G8');
  const catHeader = ws.getCell('B8');
  catHeader.value = 'Počet bodů podle kategorií';
  catHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TAP_RED } };
  catHeader.alignment = { vertical: 'middle' };
  ws.getRow(8).height = 18;

  // Build category map from rows
  const categoryMap: Record<string, number> = {};
  for (const row of rows) {
    if (row.category) categoryMap[row.category] = (categoryMap[row.category] ?? 0) + row.points;
  }
  const total = stats.approvedPoints || 1;

  const knownCategories = ALL_CATEGORIES;
  let catRow = 9;
  for (const catName of knownCategories) {
    const pts = categoryMap[catName] ?? 0;
    ws.getRow(catRow).height = 16;
    labelCell(ws, `B${catRow}`, catName);
    valueCell(ws, `C${catRow}`, pts);
    const pctCell = ws.getCell(`D${catRow}`);
    pctCell.value = pts / total;
    pctCell.numFmt = '0.0%';
    pctCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF777777' } };
    pctCell.alignment = { horizontal: 'left', vertical: 'middle' };
    catRow++;
  }

  // Unknown categories
  for (const [name, pts] of Object.entries(categoryMap)) {
    if (!knownCategories.includes(name) && name) {
      ws.getRow(catRow).height = 16;
      labelCell(ws, `B${catRow}`, name);
      valueCell(ws, `C${catRow}`, pts);
      catRow++;
    }
  }

  borderedBlock(ws, 9, catRow - 1, [2, 3, 4]);

  // ── Spacer ──
  const listStart = catRow + 2;

  // ── Book list section title ──
  ws.mergeCells(`B${listStart}:G${listStart}`);
  const listTitle = ws.getCell(`B${listStart}`);
  listTitle.value = 'Seznam přečtených knih';
  listTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: TAP_RED } };
  listTitle.alignment = { vertical: 'middle' };
  ws.getRow(listStart).height = 22;

  // ── Header row ──
  const headerRow = listStart + 1;
  ws.getRow(headerRow).height = 22;

  const headers = ['#', 'Název knihy/Zdroje', 'Autor', 'Odkaz na esej', 'Kategorie', 'Zdroj', 'Počet bodů'];
  headers.forEach((h, i) => {
    redCell(ws, ws.getRow(headerRow).getCell(i + 1).address, h, { size: 10 });
  });

  // ── Data rows ──
  rows.forEach((row, i) => {
    const r = headerRow + 1 + i;
    const excelRow = ws.getRow(r);
    excelRow.height = 16;
    const isEven = i % 2 === 1;
    const rowBg = isEven ? GRAY_ROW : 'FFFFFFFF';

    const setDataCell = (col: number, value: string | number | ExcelJS.CellHyperlinkValue) => {
      const cell = excelRow.getCell(col);
      cell.value = value;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1A1A1A' } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        top: thin(), bottom: thin(), left: thin(), right: thin(),
      };
    };

    setDataCell(1, row.index);
    excelRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF666666' } };
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };

    setDataCell(2, row.bookTitle);
    excelRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true };

    setDataCell(3, row.author);
    excelRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: 'FF555555' } };

    // Hyperlink cell
    const linkCell = excelRow.getCell(4);
    linkCell.value = { text: 'Esej', hyperlink: row.essayUrl };
    linkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
    linkCell.font = { name: 'Calibri', size: 10, color: { argb: TAP_RED }, underline: true };
    linkCell.alignment = { vertical: 'middle', horizontal: 'center' };
    linkCell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };

    setDataCell(5, row.category);
    setDataCell(6, row.source);

    const ptsCell = excelRow.getCell(7);
    ptsCell.value = row.points;
    ptsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
    ptsCell.font = {
      name: 'Calibri', size: 10, bold: true,
      color: { argb: row.points === 3 ? 'FF6B21A8' : row.points === 2 ? 'FF1D4ED8' : 'FF166534' },
    };
    ptsCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ptsCell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };
  });

  // ── Footer totals row ──
  if (rows.length > 0) {
    const footerRow = headerRow + 1 + rows.length;
    ws.getRow(footerRow).height = 18;
    ws.mergeCells(`B${footerRow}:F${footerRow}`);
    const footerLabel = ws.getCell(`B${footerRow}`);
    footerLabel.value = `Celkem ${rows.length} ${rows.length === 1 ? 'kniha' : rows.length < 5 ? 'knihy' : 'knih'}`;
    footerLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_RED } };
    footerLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TAP_RED } };
    footerLabel.border = { top: thin('FF999999'), bottom: thin('FF999999'), left: thin('FF999999') };

    const footerTotal = ws.getCell(`G${footerRow}`);
    footerTotal.value = stats.approvedPoints;
    footerTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_RED } };
    footerTotal.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TAP_RED } };
    footerTotal.alignment = { horizontal: 'center', vertical: 'middle' };
    footerTotal.border = { top: thin('FF999999'), bottom: thin('FF999999'), right: thin('FF999999') };
  }
}
