/**
 * Stahování souborů značky v prohlížeči (jen z klientských komponent).
 * Písma se vkládají do SVG jako data URI (subset Latin + Latin Extended
 * v `public/fonts/kasa/`), aby PNG i SVG měly háčky a čárky i bez
 * nainstalovaných písem.
 */
import { buildSvgDocument, type FontFamily, type KasaAsset } from "./assets";
import { fontFaceRule, KASA_FONT_BASE_URL, KASA_FONT_FILES } from "./fonts";

const FILE_PREFIX = "komunitni-kasa_";
const ZIP_NAME = "komunitni-kasa-znacka";
const PNG_RENDER_DELAY_MS = 120;

const ZIP_README = [
  "Komunitní kasa · podklady pro označení",
  "",
  "Barvy: červená #A3202E, tmavá #2B1B1E, bílá #FFFFFF",
  "Písma: Poppins (nadpisy), Roboto (text) – licence OFL / Apache 2.0",
  "SVG obsahují vložená písma; pro tiskárnu je převeď na křivky.",
  "",
].join("\n");

const fontCssCache = new Map<FontFamily, Promise<string>>();

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("font"));
    reader.readAsDataURL(blob);
  });
}

async function familyCss(family: FontFamily): Promise<string> {
  const rules = await Promise.all(
    KASA_FONT_FILES[family].map(async ({ weight, file }) => {
      const res = await fetch(`${KASA_FONT_BASE_URL}/${file}`);
      if (!res.ok) throw new Error(`Font ${file}: ${res.status}`);
      const dataUrl = await blobToDataUrl(await res.blob());
      return fontFaceRule(family, weight, dataUrl);
    }),
  );
  return rules.join("");
}

export async function loadFontCss(families: FontFamily[]): Promise<string> {
  const parts = await Promise.all(
    families.map((family) => {
      let cached = fontCssCache.get(family);
      if (!cached) {
        cached = familyCss(family);
        cached.catch(() => fontCssCache.delete(family));
        fontCssCache.set(family, cached);
      }
      return cached;
    }),
  );
  return parts.join("");
}

export async function svgToPngBlob(svg: string, widthPx: number, heightPx: number): Promise<Blob> {
  const sized = svg.replace(/^<svg ([^>]*?) width="[^"]*" height="[^"]*"/, `<svg $1 width="${widthPx}" height="${heightPx}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG se nepodařilo načíst"));
      img.src = url;
    });
    if (document.fonts) await document.fonts.ready;
    // Safari vykreslí vložená písma až po dalším snímku.
    await new Promise((resolve) => setTimeout(resolve, PNG_RENDER_DELAY_MS));
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas není k dispozici");
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportSvg(asset: KasaAsset): Promise<string> {
  return buildSvgDocument(asset, await loadFontCss(asset.fonts));
}

async function exportPng(asset: KasaAsset): Promise<Blob> {
  const height = Math.round((asset.height * asset.pngWidth) / asset.width);
  return svgToPngBlob(await exportSvg(asset), asset.pngWidth, height);
}

export async function downloadAsset(asset: KasaAsset, format: "svg" | "png"): Promise<void> {
  const base = `${FILE_PREFIX}${asset.id}`;
  if (format === "svg") {
    downloadBlob(new Blob([await exportSvg(asset)], { type: "image/svg+xml" }), `${base}.svg`);
    return;
  }
  downloadBlob(await exportPng(asset), `${base}.png`);
}

export async function downloadAllAssetsZip(assets: KasaAsset[]): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("README.txt", ZIP_README);
  await Promise.all(
    assets.map(async (asset) => {
      zip.file(`svg/${asset.id}.svg`, await exportSvg(asset));
      zip.file(`png/${asset.id}.png`, await exportPng(asset));
    }),
  );
  downloadBlob(await zip.generateAsync({ type: "blob" }), `${ZIP_NAME}.zip`);
}
