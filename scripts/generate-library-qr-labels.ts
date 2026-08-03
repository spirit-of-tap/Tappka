// Generates a print-ready HTML sheet of small QR labels, one per physical
// copy in the TAP Knihovna, for sticking directly on the books. Run with:
//   pnpm tsx --env-file=.env.local scripts/generate-library-qr-labels.ts
// Open the output in a browser and print, or use "Save as PDF."
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL ?? 'https://tiimi.cz';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Tweak these to change label density — page/column/row counts derive from them.
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 8;
const LABEL_WIDTH_MM = 32;
const LABEL_HEIGHT_MM = 34;
const LABEL_GAP_MM = 2;

const COLUMNS = Math.floor(
  (PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2 + LABEL_GAP_MM) / (LABEL_WIDTH_MM + LABEL_GAP_MM),
);
const ROWS = Math.floor(
  (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2 + LABEL_GAP_MM) / (LABEL_HEIGHT_MM + LABEL_GAP_MM),
);
const LABELS_PER_PAGE = COLUMNS * ROWS;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface LibraryBookRow {
  id: string;
  book: { id: string; title_cs: string } | null;
}

interface LabelBook {
  bookId: string;
  title: string;
}

async function fetchLibraryBooks(): Promise<LabelBook[]> {
  const { data, error } = await supabase.from('library_books').select('id, book:books(id, title_cs)');
  if (error) throw error;

  return ((data ?? []) as unknown as LibraryBookRow[])
    .filter((row): row is LibraryBookRow & { book: NonNullable<LibraryBookRow['book']> } => row.book != null)
    .map((row) => ({ bookId: row.book.id, title: row.book.title_cs }))
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildLabelHtml({ bookId, title }: LabelBook): Promise<string> {
  const url = `${SITE_URL}/knihovna/${bookId}/pujcit`;
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  return `
    <div class="label">
      <svg class="brand" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="128" fill="#b31b1b"/>
        <text x="256" y="360" font-family="Poppins, sans-serif" font-size="280" font-weight="bold" fill="#fcfff7" text-anchor="middle">T</text>
      </svg>
      <div class="qr">${qrSvg}</div>
      <div class="title">${escapeHtml(title)}</div>
    </div>`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildDocument(labelHtmls: string[]): string {
  const pages = chunk(labelHtmls, LABELS_PER_PAGE);
  const pagesHtml = pages.map((page) => `<div class="page">${page.join('')}</div>`).join('\n');

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Tappka – QR štítky knihovny</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Poppins', Arial, sans-serif; }
    .page {
      display: grid;
      grid-template-columns: repeat(${COLUMNS}, ${LABEL_WIDTH_MM}mm);
      grid-auto-rows: ${LABEL_HEIGHT_MM}mm;
      gap: ${LABEL_GAP_MM}mm;
      justify-content: start;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .label {
      border: 0.2mm dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.8mm;
      padding: 1mm;
      overflow: hidden;
    }
    .brand { width: 4mm; height: 4mm; flex-shrink: 0; }
    .qr { width: 22mm; height: 22mm; flex-shrink: 0; }
    .qr svg { width: 100%; height: 100%; display: block; }
    .title {
      font-size: 2.2mm;
      line-height: 1.15;
      text-align: center;
      color: #2c1a1d;
      max-width: 100%;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    @media screen {
      body { background: #eee; padding: 10mm 0; }
      .page { background: white; margin: 0 auto 10mm; box-shadow: 0 1mm 4mm rgba(0,0,0,0.15); }
    }
  </style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

async function main() {
  const books = await fetchLibraryBooks();
  console.log(`Found ${books.length} physical copies in the library.`);
  if (books.length === 0) return;

  const labelHtmls = await Promise.all(books.map(buildLabelHtml));
  const html = buildDocument(labelHtmls);

  const outDir = path.join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'library-qr-labels.html');
  writeFileSync(outPath, html, 'utf-8');

  const pageCount = Math.ceil(books.length / LABELS_PER_PAGE);
  console.log(`${LABELS_PER_PAGE} labels/page (${COLUMNS}×${ROWS}) → ${pageCount} pages for ${books.length} labels.`);
  console.log(`Written to ${outPath}`);
  console.log('Open it in a browser and print, or use "Save as PDF."');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
