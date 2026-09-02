// Generates five print-ready A4 sheets of sequential QR labels for physical
// library copies. The labels do not need database rows before they are printed.
// Run with: node --experimental-strip-types scripts/generate-library-qr-labels.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import QRCode from 'qrcode';

const DEFAULT_SITE_URL = 'https://tiimi.cz';
const DEFAULT_START_LABEL_CODE = 1;
const DEFAULT_LABEL_COUNT = 350;
const LABEL_CODE_DIGITS = 3;
const BRAND_RED = '#b31b1b';
const BRAND_LIGHT = '#fcfff7';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 7;
const LABEL_WIDTH_MM = 27;
const LABEL_HEIGHT_MM = 27;
const LABEL_GAP_MM = 1;
const QR_SIZE_MM = 19;

const COLUMNS = Math.floor(
  (PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2 + LABEL_GAP_MM) / (LABEL_WIDTH_MM + LABEL_GAP_MM),
);
const ROWS = Math.floor(
  (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2 + LABEL_GAP_MM) / (LABEL_HEIGHT_MM + LABEL_GAP_MM),
);
const LABELS_PER_PAGE = COLUMNS * ROWS;

interface LibraryLabel {
  code: number;
  url: string;
}

function readPositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value == null) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function buildLabels(): LibraryLabel[] {
  const siteUrl = (process.env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
  const startCode = readPositiveInteger(
    process.env.LIBRARY_LABEL_START,
    DEFAULT_START_LABEL_CODE,
    'LIBRARY_LABEL_START',
  );
  const labelCount = readPositiveInteger(
    process.env.LIBRARY_LABEL_COUNT,
    DEFAULT_LABEL_COUNT,
    'LIBRARY_LABEL_COUNT',
  );

  return Array.from({ length: labelCount }, (_, index) => {
    const code = startCode + index;
    return { code, url: `${siteUrl}/l/${code}` };
  });
}

async function buildLabelHtml({ code, url }: LibraryLabel): Promise<string> {
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  return `
    <div class="label" data-label-code="${code}" data-url="${url}">
      <div class="brand">
        <svg class="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="${BRAND_RED}"/>
          <text x="16" y="23" fill="${BRAND_LIGHT}" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle">T</text>
        </svg>
        <span>TAPPKA</span>
      </div>
      <div class="qr">${qrSvg}</div>
      <div class="caption"><span>KNIHOVNA</span><strong>#${String(code).padStart(LABEL_CODE_DIGITS, '0')}</strong></div>
    </div>`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildDocument(labelHtmls: string[]): string {
  const pages = chunk(labelHtmls, LABELS_PER_PAGE);
  const pagesHtml = pages.map((page) => `<div class="page">${page.join('')}</div>`).join('\n');

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tappka – QR štítky knihovny</title>
  <style>
    @page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .page {
      display: grid;
      grid-template-columns: repeat(${COLUMNS}, ${LABEL_WIDTH_MM}mm);
      grid-auto-rows: ${LABEL_HEIGHT_MM}mm;
      gap: ${LABEL_GAP_MM}mm;
      break-after: page;
      page-break-after: always;
    }
    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .label {
      border: 0.2mm dashed #b8b8b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2mm;
      overflow: hidden;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.7mm;
      color: ${BRAND_RED};
      font-size: 2.2mm;
      font-weight: 700;
      letter-spacing: 0.15mm;
      line-height: 1;
    }
    .brand-icon { width: 3mm; height: 3mm; flex: 0 0 auto; }
    .qr { width: ${QR_SIZE_MM}mm; height: ${QR_SIZE_MM}mm; flex: 0 0 auto; }
    .qr svg { display: block; width: 100%; height: 100%; }
    .caption {
      display: flex;
      align-items: baseline;
      gap: 0.8mm;
      color: ${BRAND_RED};
      font-size: 1.8mm;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.05mm;
      white-space: nowrap;
    }
    .caption strong { color: #000; font-size: 2mm; }
    @media screen {
      body { background: #eee; padding: 10mm 0; }
      .page {
        width: ${PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2}mm;
        min-height: ${PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2}mm;
        background: #fff;
        margin: 0 auto 10mm;
        box-shadow: 0 1mm 4mm rgb(0 0 0 / 15%);
      }
    }
  </style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

async function main(): Promise<void> {
  const labels = buildLabels();
  const labelHtmls = await Promise.all(labels.map(buildLabelHtml));
  const html = buildDocument(labelHtmls);

  const outDir = path.join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'library-qr-labels.html');
  writeFileSync(outPath, html, 'utf-8');

  const pageCount = Math.ceil(labels.length / LABELS_PER_PAGE);
  const firstCode = labels[0].code;
  const lastCode = labels.at(-1)?.code ?? firstCode;
  console.log(`${labels.length} labels (${firstCode}–${lastCode}), ${LABELS_PER_PAGE} per A4 page (${COLUMNS}×${ROWS}).`);
  console.log(`${pageCount} pages written to ${outPath}`);
  console.log('Print at 100% scale with browser headers and footers disabled.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
