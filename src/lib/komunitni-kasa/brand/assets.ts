/**
 * SVG šablony souborů ke stažení — souřadnice, velikosti a texty jsou
 * přeneseny 1:1 z `FILES` v `kom_kasa/oznaceni/src.html`.
 */
import { KASA_COLORS, KASA_MARK_COIN, KASA_MARK_SEGMENTS_PATH } from "./constants";

export type FontFamily = "Poppins" | "Roboto";

export type KasaAssetId =
  | "logo"
  | "logo-bile"
  | "sestava"
  | "samolepka"
  | "tkany"
  | "odznak"
  | "odznak-tmavy"
  | "prispevek"
  | "banner";

export type KasaFileId = KasaAssetId | "plakat" | "arch-samolepek";

export interface KasaAsset {
  id: KasaFileId;
  name: string;
  hint: string;
  width: number;
  height: number;
  pngWidth: number;
  mm?: [number, number];
  fonts: FontFamily[];
  /** Tmavý náhled (bílá značka, tmavý štítek). */
  darkPreview?: boolean;
  /** Celá stránka (A4) — náhled bez okraje kolem. */
  fullPage?: boolean;
  body: () => string;
}

export interface RolePosterFields {
  role: string;
  kdo: string;
  druzstvo: string;
  obdobi: string;
  napln: string;
}

export const STICKER_SHEET = { columns: 3, rows: 10, stickerMm: [60, 25], gapMm: [5, 2] } as const;

const A4_MM: [number, number] = [210, 297];
const POSTER_NAPLN_MAX_CHARS = 48;
const POSTER_NAPLN_MAX_LINES = 6;
/** Šířky sloupců plakátu (840 jednotek, okraj 70/72): role přes celou šířku, jméno/družstvo vlevo, období vpravo. */
const POSTER_ROLE_MAX_WIDTH = 700;
const POSTER_KDO_MAX_WIDTH = 370;
const POSTER_OBDOBI_MAX_WIDTH = 300;
const BOTH_FONTS: FontFamily[] = ["Poppins", "Roboto"];
const { RED, INK, MUTED, WHITE, MUTED_ON_DARK, RULE } = KASA_COLORS;

export function escapeSvgText(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Zalomí text po slovech; odstavce zachová, dlouhá slova rozdělí, nejvýš maxLines řádků. */
export function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const rawWord of para.trim().split(/\s+/).filter(Boolean)) {
      const chunks: string[] = [];
      for (let i = 0; i < rawWord.length; i += maxChars) chunks.push(rawWord.slice(i, i + maxChars));
      for (const word of chunks) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxChars) {
          out.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
    }
    if (line) out.push(line);
  }
  return out.slice(0, maxLines);
}

/** Odhad šířky znaku vůči velikosti písma (Poppins tučné je široké). */
const CHAR_WIDTH_RATIO = { Poppins: 0.62, Roboto: 0.52 } as const;

/**
 * Atribut `textLength`, který dlouhý text stáhne do dané šířky; krátký text
 * nechá být. Bez něj by dlouhé jméno nebo role přetekly přes okraj plakátu.
 */
function fitAttr(text: string, family: FontFamily, fontSize: number, maxWidth: number): string {
  const estimated = text.length * fontSize * CHAR_WIDTH_RATIO[family];
  return estimated > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "";
}

export function markSvg(fill: string): string {
  return `<path fill="${fill}" d="${KASA_MARK_SEGMENTS_PATH}"/><circle fill="${fill}" cx="${KASA_MARK_COIN.cx}" cy="${KASA_MARK_COIN.cy}" r="${KASA_MARK_COIN.r}"/>`;
}

function markAt(fill: string, x: number, y: number, size: number): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${markSvg(fill)}</svg>`;
}

/** Sestava: značka + Financováno z / komunitní kasy / Spirit of TAP, z.s. (520 × 160). */
function lockup(markFill: string, ink: string, muted: string): string {
  return (
    markAt(markFill, 6, 14, 132) +
    `<text x="162" y="56" font-family="Roboto" font-size="30" fill="${ink}">Financováno z</text>` +
    `<text x="160" y="104" font-family="Poppins" font-weight="700" font-size="40" fill="${ink}">komunitní kasy</text>` +
    `<text x="162" y="144" font-family="Roboto" font-size="25" fill="${muted}">Spirit of TAP, z.s.</text>`
  );
}

function stickerBody(): string {
  return (
    `<rect width="600" height="250" rx="22" fill="${WHITE}"/>` +
    `<rect x="3" y="3" width="594" height="244" rx="20" fill="none" stroke="${RED}" stroke-width="6"/>` +
    markAt(RED, 36, 55, 140) +
    `<text x="208" y="98" font-family="Roboto" font-size="32" fill="${INK}">Financováno z</text>` +
    `<text x="206" y="150" font-family="Poppins" font-weight="700" font-size="42" fill="${INK}">komunitní kasy</text>` +
    `<text x="208" y="192" font-family="Roboto" font-size="26" fill="${MUTED}">Spirit of TAP, z.s.</text>`
  );
}

export const KASA_ASSETS: KasaAsset[] = [
  {
    id: "logo",
    name: "Značka",
    hint: "Červená na průhledném pozadí. Pro světlé podklady.",
    width: 100,
    height: 100,
    pngWidth: 1024,
    fonts: [],
    body: () => markSvg(RED),
  },
  {
    id: "logo-bile",
    name: "Značka bílá",
    hint: "Na tmavé a červené podklady.",
    width: 100,
    height: 100,
    pngWidth: 1024,
    fonts: [],
    darkPreview: true,
    body: () => markSvg(WHITE),
  },
  {
    id: "sestava",
    name: "Sestava s textem",
    hint: "Značka s větou. Dokumenty, zápatí, web.",
    width: 520,
    height: 160,
    pngWidth: 1560,
    fonts: BOTH_FONTS,
    body: () => lockup(RED, INK, MUTED),
  },
  {
    id: "samolepka",
    name: "Samolepka 60 × 25 mm",
    hint: "Tisková data pro věci a vybavení.",
    width: 600,
    height: 250,
    mm: [60, 25],
    pngWidth: 1800,
    fonts: BOTH_FONTS,
    body: stickerBody,
  },
  {
    id: "tkany",
    name: "Tkaný štítek 40 × 15 mm",
    hint: "Podklad pro výrobce, všívá se do textilu.",
    width: 400,
    height: 150,
    mm: [40, 15],
    pngWidth: 1200,
    fonts: ["Poppins"],
    darkPreview: true,
    body: () =>
      `<rect width="400" height="150" fill="${RED}"/>` +
      markAt(WHITE, 34, 30, 90) +
      `<text x="148" y="70" font-family="Poppins" font-weight="600" font-size="38" fill="${WHITE}">komunitní</text>` +
      `<text x="148" y="114" font-family="Poppins" font-weight="600" font-size="38" fill="${WHITE}">kasa</text>`,
  },
  {
    id: "odznak",
    name: "Odznak světlý",
    hint: "Slidy, aplikace a dokumenty na světlém pozadí.",
    width: 520,
    height: 160,
    pngWidth: 1560,
    fonts: BOTH_FONTS,
    body: () => lockup(RED, INK, MUTED),
  },
  {
    id: "odznak-tmavy",
    name: "Odznak tmavý",
    hint: "Tmavé slidy a pozadí.",
    width: 520,
    height: 160,
    pngWidth: 1560,
    fonts: BOTH_FONTS,
    darkPreview: true,
    body: () => lockup(WHITE, WHITE, MUTED_ON_DARK),
  },
  {
    id: "prispevek",
    name: "Příspěvek 1080 × 1080",
    hint: "Sociální sítě, k akcím podpořeným kasou.",
    width: 1080,
    height: 1080,
    pngWidth: 1080,
    fonts: BOTH_FONTS,
    body: () =>
      `<rect width="1080" height="1080" fill="${RED}"/>` +
      markAt(WHITE, 110, 120, 260) +
      `<text x="104" y="620" font-family="Poppins" font-weight="700" font-size="96" fill="${WHITE}">Akci podpořila</text>` +
      `<text x="104" y="730" font-family="Poppins" font-weight="700" font-size="96" fill="${WHITE}">komunitní kasa</text>` +
      `<text x="110" y="940" font-family="Roboto" font-weight="500" font-size="32" letter-spacing="4" fill="${WHITE}" fill-opacity=".8">SPIRIT OF TAP, Z.S.</text>`,
  },
  {
    id: "banner",
    name: "Banner 1920 × 600",
    hint: "Úvodní obrázek webu, události nebo prezentace.",
    width: 1920,
    height: 600,
    pngWidth: 1920,
    fonts: BOTH_FONTS,
    body: () =>
      `<rect width="1920" height="600" fill="${RED}"/>` +
      markAt(WHITE, 1380, 60, 480) +
      `<text x="140" y="210" font-family="Roboto" font-weight="500" font-size="30" letter-spacing="5" fill="${WHITE}" fill-opacity=".8">SPIRIT OF TAP, Z.S.</text>` +
      `<text x="136" y="330" font-family="Poppins" font-weight="700" font-size="104" fill="${WHITE}">Financováno z</text>` +
      `<text x="136" y="445" font-family="Poppins" font-weight="700" font-size="104" fill="${WHITE}">komunitní kasy</text>`,
  },
];

export function rolePosterAsset(fields: RolePosterFields): KasaAsset {
  const e = escapeSvgText;
  const allLines = wrapLines(fields.napln, POSTER_NAPLN_MAX_CHARS, Number.POSITIVE_INFINITY);
  const shown = allLines.slice(0, POSTER_NAPLN_MAX_LINES);
  if (allLines.length > shown.length) shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
  const naplnLines = shown
    .map(
      (line, i) =>
        `<text x="72" y="${760 + i * 40}" font-family="Roboto" font-size="27" fill="${INK}">${e(line)}</text>`,
    )
    .join("");
  return {
    id: "plakat",
    name: "Plakát komunitní role",
    hint: "A4, vyplněný z polí.",
    width: 840,
    height: 1188,
    mm: A4_MM,
    pngWidth: 2480,
    fonts: BOTH_FONTS,
    fullPage: true,
    body: () =>
      `<rect width="840" height="1188" fill="${WHITE}"/>` +
      `<rect width="840" height="420" fill="${RED}"/>` +
      markAt(WHITE, 72, 72, 120) +
      `<text x="72" y="300" font-family="Roboto" font-weight="500" font-size="26" letter-spacing="5" fill="${WHITE}" fill-opacity=".85">KOMUNITNÍ ROLE</text>` +
      `<text x="70" y="370" font-family="Poppins" font-weight="700" font-size="62" fill="${WHITE}"${fitAttr(fields.role, "Poppins", 62, POSTER_ROLE_MAX_WIDTH)}>${e(fields.role)}</text>` +
      `<text x="72" y="510" font-family="Roboto" font-size="22" fill="${MUTED}">Roli zastává</text>` +
      `<text x="72" y="554" font-family="Poppins" font-weight="600" font-size="34" fill="${INK}"${fitAttr(fields.kdo, "Poppins", 34, POSTER_KDO_MAX_WIDTH)}>${e(fields.kdo)}</text>` +
      `<text x="72" y="592" font-family="Roboto" font-size="24" fill="${INK}"${fitAttr(fields.druzstvo, "Roboto", 24, POSTER_KDO_MAX_WIDTH)}>${e(fields.druzstvo)}</text>` +
      `<text x="460" y="510" font-family="Roboto" font-size="22" fill="${MUTED}">Období</text>` +
      `<text x="460" y="554" font-family="Poppins" font-weight="600" font-size="26" fill="${INK}"${fitAttr(fields.obdobi, "Poppins", 26, POSTER_OBDOBI_MAX_WIDTH)}>${e(fields.obdobi)}</text>` +
      `<line x1="72" y1="650" x2="768" y2="650" stroke="${RULE}" stroke-width="2"/>` +
      `<text x="72" y="712" font-family="Roboto" font-size="22" fill="${MUTED}">Náplň role</text>` +
      naplnLines +
      `<line x1="72" y1="1000" x2="768" y2="1000" stroke="${RULE}" stroke-width="2"/>` +
      `<svg x="72" y="1030" width="400" height="123" viewBox="0 0 520 160">${lockup(RED, INK, MUTED)}</svg>`,
  };
}

/** A4 arch (viewBox v mm) se 3 × 10 samolepkami 60 × 25 mm, mřížka na středu. */
export function stickerSheetAsset(): KasaAsset {
  const { columns, rows, stickerMm, gapMm } = STICKER_SHEET;
  const gridW = columns * stickerMm[0] + (columns - 1) * gapMm[0];
  const gridH = rows * stickerMm[1] + (rows - 1) * gapMm[1];
  const left = (A4_MM[0] - gridW) / 2;
  const top = (A4_MM[1] - gridH) / 2;
  return {
    id: "arch-samolepek",
    name: "Arch samolepek A4",
    hint: "30 samolepek 60 × 25 mm.",
    width: A4_MM[0],
    height: A4_MM[1],
    mm: A4_MM,
    pngWidth: 2480,
    fonts: BOTH_FONTS,
    fullPage: true,
    body: () => {
      const sticker = stickerBody();
      let out = `<rect width="${A4_MM[0]}" height="${A4_MM[1]}" fill="${WHITE}"/>`;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < columns; c += 1) {
          const x = left + c * (stickerMm[0] + gapMm[0]);
          const y = top + r * (stickerMm[1] + gapMm[1]);
          out += `<svg data-sticker="" x="${x}" y="${y}" width="${stickerMm[0]}" height="${stickerMm[1]}" viewBox="0 0 600 250">${sticker}</svg>`;
        }
      }
      return out;
    },
  };
}

/** Kompletní SVG dokument; velikost v mm, pokud ji asset má, jinak v px. */
export function buildSvgDocument(asset: KasaAsset, fontCss?: string): string {
  const size = asset.mm
    ? `width="${asset.mm[0]}mm" height="${asset.mm[1]}mm"`
    : `width="${asset.width}" height="${asset.height}"`;
  const style = fontCss ? `<style>${fontCss}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${asset.width} ${asset.height}" ${size}>${style}${asset.body()}</svg>`;
}

const PREVIEW_PADDING_RATIO = 0.12;

/**
 * Náhled pro stránku: responzivní (bez width/height), s vlastním podkladem
 * (bílým, nebo tmavým pro bílé varianty), aby byl čitelný ve světlém i tmavém
 * motivu aplikace.
 */
export function buildSvgPreview(asset: KasaAsset, label: string = asset.name, aspect?: number): string {
  const pad = asset.fullPage ? 0 : Math.round(Math.max(asset.width, asset.height) * PREVIEW_PADDING_RATIO);
  let w = asset.width + pad * 2;
  let h = asset.height + pad * 2;
  if (aspect) {
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
  }
  const x = (asset.width - w) / 2;
  const y = (asset.height - h) / 2;
  const backdrop = asset.darkPreview ? INK : WHITE;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="${escapeSvgText(label)}" preserveAspectRatio="xMidYMid meet">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${backdrop}"/>` +
    asset.body() +
    `</svg>`
  );
}
