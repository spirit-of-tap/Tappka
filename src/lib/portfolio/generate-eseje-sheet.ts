import type { PortfolioEsejeRow } from './types';

const DATA_START_ROW = 33;
const DATA_END_ROW = 127;

const EXCEL_VALID_CATEGORIES = new Set([
  'Duchovní růst', 'Inovace', 'Koučování', 'Management', 'Marketing',
  'Podnikání', 'Společnost', 'Učení', 'Vedení', 'Jiné',
]);

function toExcelCategory(category: string): string {
  return EXCEL_VALID_CATEGORIES.has(category) ? category : 'Jiné';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStyle(rowXml: string, col: string, rowNum: number): string {
  const m = rowXml.match(new RegExp(`<c r="${col}${rowNum}"[^>]*s="(\\d+)"[^>]*>`));
  return m?.[1] ?? '0';
}

export function patchEsejeSheetXml(xml: string, rows: PortfolioEsejeRow[]): string {
  const dateStr = new Date().toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Replace row 1 with banner. Must exclude `/` from attrs class so self-closing
  // `<row r="1" .../>` doesn't fall through to the `>...</row>` branch and eat row 2.
  const banner = `<row r="1"$1><c r="B1" t="inlineStr"><is><t>Vyplneno automaticky z Tappka · ${dateStr}</t></is></c></row>`;
  xml = xml.replace(/<row r="1"([^/>]*)(?:\/>|>[\s\S]*?<\/row>)/, banner);

  for (let rowNum = DATA_START_ROW; rowNum <= DATA_END_ROW; rowNum++) {
    const dataIdx = rowNum - DATA_START_ROW;
    const rowRegex = new RegExp(`<row r="${rowNum}"([^>]*)>[\\s\\S]*?</row>`);
    const match = xml.match(rowRegex);
    if (!match) continue;

    const orig = match[0];
    const attrs = match[1];
    const s = (col: string) => getStyle(orig, col, rowNum);

    let newRow: string;
    if (dataIdx < rows.length) {
      const r = rows[dataIdx];
      const url = esc(r.essayUrl);
      newRow =
        `<row r="${rowNum}"${attrs}>` +
        `<c r="A${rowNum}" s="${s('A')}"><v>${r.index}</v></c>` +
        `<c r="B${rowNum}" s="${s('B')}" t="inlineStr"><is><t>${esc(r.bookTitle)}</t></is></c>` +
        `<c r="C${rowNum}" s="${s('C')}" t="inlineStr"><is><t>${esc(r.author)}</t></is></c>` +
        `<c r="D${rowNum}" s="${s('D')}" t="str"><f>HYPERLINK(&quot;${url}&quot;,&quot;Esej&quot;)</f><v>Esej</v></c>` +
        `<c r="E${rowNum}" s="${s('E')}" t="inlineStr"><is><t>${esc(toExcelCategory(r.category))}</t></is></c>` +
        `<c r="F${rowNum}" s="${s('F')}" t="inlineStr"><is><t>Kniha</t></is></c>` +
        `<c r="G${rowNum}" s="${s('G')}"><v>${r.points}</v></c>` +
        `</row>`;
    } else {
      // Clear values but keep cell style so formatting is preserved
      newRow =
        `<row r="${rowNum}"${attrs}>` +
        `<c r="A${rowNum}" s="${s('A')}"><v>${rowNum - DATA_START_ROW + 1}</v></c>` +
        `<c r="B${rowNum}" s="${s('B')}"/>` +
        `<c r="C${rowNum}" s="${s('C')}"/>` +
        `<c r="D${rowNum}" s="${s('D')}"/>` +
        `<c r="E${rowNum}" s="${s('E')}"/>` +
        `<c r="F${rowNum}" s="${s('F')}"/>` +
        `<c r="G${rowNum}" s="${s('G')}"/>` +
        `</row>`;
    }

    xml = xml.replace(rowRegex, newRow);
  }

  // Strip stale relationship-based hyperlinks for D33..D127 — the template may have
  // clicked-in hyperlinks on those cells referencing rIds; our formula cells replace them.
  xml = xml.replace(
    /<hyperlink[^/]*ref="D(\d+)"[^/]*\/>/g,
    (m, row) => {
      const n = Number(row);
      return n >= DATA_START_ROW && n <= DATA_END_ROW ? '' : m;
    },
  );
  // If <hyperlinks> ends up empty, remove the wrapper to keep the XML tidy.
  xml = xml.replace(/<hyperlinks>\s*<\/hyperlinks>/, '');

  return xml;
}
