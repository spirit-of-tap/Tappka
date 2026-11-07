import type { FontFamily } from "./assets";

/** Subset Latin + Latin Extended (čeština) z písem manuálu, viz `public/fonts/kasa/`. */
export const KASA_FONT_BASE_URL = "/fonts/kasa";

export const KASA_FONT_FILES: Record<FontFamily, { weight: number; file: string }[]> = {
  Poppins: [
    { weight: 600, file: "poppins-600.woff" },
    { weight: 700, file: "poppins-700.woff" },
  ],
  Roboto: [
    { weight: 400, file: "roboto-400.woff" },
    { weight: 500, file: "roboto-500.woff" },
  ],
};

export function fontFaceRule(family: FontFamily, weight: number, src: string): string {
  return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:swap;src:url(${src}) format("woff");}`;
}

/** @font-face pravidla s URL na statické soubory — pro inline SVG náhledy na stránce. */
export const KASA_FONT_FACE_CSS = (Object.keys(KASA_FONT_FILES) as FontFamily[])
  .flatMap((family) =>
    KASA_FONT_FILES[family].map(({ weight, file }) => fontFaceRule(family, weight, `${KASA_FONT_BASE_URL}/${file}`)),
  )
  .join("");
