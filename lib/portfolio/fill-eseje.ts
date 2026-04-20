import type { PortfolioEsejeRow } from './types';

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HYPERLINK_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

async function findSheetPath(zip: import('jszip'), sheetName: string): Promise<string | null> {
  const parser = new DOMParser();

  const wbXml = await zip.file('xl/workbook.xml')!.async('string');
  const wbDoc = parser.parseFromString(wbXml, 'application/xml');
  let rId: string | null = null;
  for (const sheet of Array.from(wbDoc.querySelectorAll('sheet'))) {
    if (sheet.getAttribute('name') === sheetName) {
      rId = sheet.getAttributeNS(REL_NS, 'id') ?? sheet.getAttribute('r:id');
      break;
    }
  }
  if (!rId) return null;

  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const relsDoc = parser.parseFromString(relsXml, 'application/xml');
  for (const rel of Array.from(relsDoc.querySelectorAll('Relationship'))) {
    if (rel.getAttribute('Id') === rId) return rel.getAttribute('Target');
  }
  return null;
}

function colLetter(index: number): string {
  return String.fromCharCode(65 + index); // A=0, B=1 …
}

function setCellInlineString(doc: Document, row: Element, col: number, rowNum: number, value: string) {
  const ref = `${colLetter(col)}${rowNum}`;
  let cell = row.querySelector(`c[r="${ref}"]`);
  if (!cell) {
    cell = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 'c');
    row.appendChild(cell);
  }
  // Preserve style, clear type-specific attributes
  cell.setAttribute('r', ref);
  cell.setAttribute('t', 'inlineStr');
  // Remove old value nodes
  Array.from(cell.children).forEach((ch) => cell!.removeChild(ch));
  const is = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 'is');
  const t = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 't');
  t.textContent = value;
  is.appendChild(t);
  cell.appendChild(is);
}

function setCellNumber(doc: Document, row: Element, col: number, rowNum: number, value: number) {
  const ref = `${colLetter(col)}${rowNum}`;
  let cell = row.querySelector(`c[r="${ref}"]`);
  if (!cell) {
    cell = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 'c');
    row.appendChild(cell);
  }
  cell.setAttribute('r', ref);
  cell.removeAttribute('t');
  Array.from(cell.children).forEach((ch) => cell!.removeChild(ch));
  const v = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 'v');
  v.textContent = String(value);
  cell.appendChild(v);
}

function findDataStartRow(doc: Document): number {
  // Find first row where col A has a small integer (the index column)
  for (const row of Array.from(doc.querySelectorAll('sheetData > row'))) {
    const r = Number(row.getAttribute('r'));
    const cellA = row.querySelector(`c[r="A${r}"]`);
    if (cellA && !cellA.getAttribute('t')) {
      const v = cellA.querySelector('v')?.textContent;
      if (v && Number(v) >= 1 && Number(v) <= 5) return r;
    }
  }
  return 3; // fallback: Excel row 3
}

function buildHyperlinkRels(rows: PortfolioEsejeRow[], dataStartRow: number): string {
  const items = rows.map((row, i) => {
    const excelRow = dataStartRow + i;
    return `<Relationship Id="rId${i + 1}" Type="${HYPERLINK_TYPE}" Target="${escapeXml(row.essayUrl)}" TargetMode="External"/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${items.join('\n')}\n</Relationships>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function fillEsejeSheetZip(arrayBuffer: ArrayBuffer, rows: PortfolioEsejeRow[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const relPath = await findSheetPath(zip, 'Eseje');
  if (!relPath) throw new Error('List "Eseje" nenalezen v souboru');

  const sheetFilePath = `xl/${relPath}`;
  const sheetXml = await zip.file(sheetFilePath)!.async('string');

  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, 'application/xml');
  const sheetData = doc.querySelector('sheetData')!;

  const dataStartRow = findDataStartRow(doc);

  // Build a map of existing row elements by Excel row number
  const rowMap = new Map<number, Element>();
  for (const row of Array.from(sheetData.querySelectorAll('row'))) {
    rowMap.set(Number(row.getAttribute('r')), row);
  }

  // Get a template row to clone styles from (first data row)
  const templateRow = rowMap.get(dataStartRow);

  rows.forEach((row, i) => {
    const excelRow = dataStartRow + i;
    let rowEl = rowMap.get(excelRow);

    if (!rowEl) {
      // Clone template row structure (preserves row height, style etc.)
      if (templateRow) {
        rowEl = templateRow.cloneNode(true) as Element;
        rowEl.setAttribute('r', String(excelRow));
        // Update all cell refs in the cloned row
        for (const cell of Array.from(rowEl.querySelectorAll('c'))) {
          const oldRef = cell.getAttribute('r') ?? '';
          cell.setAttribute('r', oldRef.replace(/\d+$/, String(excelRow)));
        }
      } else {
        rowEl = doc.createElementNS(doc.documentElement.namespaceURI ?? '', 'row');
        rowEl.setAttribute('r', String(excelRow));
      }
      sheetData.appendChild(rowEl);
      rowMap.set(excelRow, rowEl);
    }

    setCellNumber(doc, rowEl, 0, excelRow, row.index);             // A: #
    setCellInlineString(doc, rowEl, 1, excelRow, row.bookTitle);   // B: Název knihy
    setCellInlineString(doc, rowEl, 2, excelRow, row.author);      // C: Autor
    setCellInlineString(doc, rowEl, 3, excelRow, 'Esej');          // D: hyperlink placeholder
    setCellInlineString(doc, rowEl, 4, excelRow, row.category);    // E: Kategorie
    setCellInlineString(doc, rowEl, 5, excelRow, row.source);      // F: Zdroj
    setCellNumber(doc, rowEl, 6, excelRow, row.points);            // G: Body
  });

  // Clear leftover pre-formatted empty rows beyond our data
  for (const [r, rowEl] of rowMap) {
    if (r >= dataStartRow + rows.length) {
      for (const cell of Array.from(rowEl.querySelectorAll('c'))) {
        cell.removeAttribute('t');
        Array.from(cell.children).forEach((ch) => {
          if (ch.tagName === 'v' || ch.tagName === 'is' || ch.tagName === 'f') cell.removeChild(ch);
        });
      }
    }
  }

  // Replace hyperlinks section
  const existingHyperlinks = doc.querySelector('hyperlinks');
  if (existingHyperlinks) existingHyperlinks.parentNode!.removeChild(existingHyperlinks);

  if (rows.length > 0) {
    const ns = doc.documentElement.namespaceURI ?? '';
    const hyperlinksEl = doc.createElementNS(ns, 'hyperlinks');
    rows.forEach((row, i) => {
      const excelRow = dataStartRow + i;
      const hl = doc.createElementNS(ns, 'hyperlink');
      hl.setAttribute('ref', `D${excelRow}`);
      hl.setAttributeNS(REL_NS, 'r:id', `rId${i + 1}`);
      hyperlinksEl.appendChild(hl);
    });
    // Insert hyperlinks before pageMargins/pageSetup if present, else append
    const pageMargins = doc.querySelector('pageMargins');
    if (pageMargins) pageMargins.parentNode!.insertBefore(hyperlinksEl, pageMargins);
    else doc.querySelector('worksheet')!.appendChild(hyperlinksEl);
  }

  const serializer = new XMLSerializer();
  const newSheetXml = serializer.serializeToString(doc);
  zip.file(sheetFilePath, newSheetXml);

  // Write hyperlink rels
  const sheetFileName = relPath.split('/').pop()!;
  const relsFilePath = `xl/worksheets/_rels/${sheetFileName}.rels`;
  zip.file(relsFilePath, buildHyperlinkRels(rows, dataStartRow));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
