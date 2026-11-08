/**
 * Značka komunitní kasy — převzato z `kom_kasa/oznaceni/src.html`
 * („Manuál označení komunitní kasy“, v1.0, listopad 2026). Barvy jsou
 * brandová data pro generované soubory a SVG značky, ne UI tokeny.
 */

export const KASA_COLORS = {
  RED: "#A3202E",
  INK: "#2B1B1E",
  MUTED: "#6E5F61",
  WHITE: "#FFFFFF",
  MUTED_ON_DARK: "#E3D6D6",
  RULE: "#E7E1DD",
} as const;

export interface KasaColorSpec {
  name: string;
  hex: string;
  rgb: string;
  cmyk: string;
}

export const KASA_COLOR_SPECS: KasaColorSpec[] = [
  { name: "Červená", hex: KASA_COLORS.RED, rgb: "163 32 46", cmyk: "0 80 72 36" },
  { name: "Tmavá", hex: KASA_COLORS.INK, rgb: "43 27 30", cmyk: "0 37 30 83" },
  { name: "Bílá", hex: KASA_COLORS.WHITE, rgb: "255 255 255", cmyk: "0 0 0 0" },
];

/** Šest segmentů (SEG6) ve viewBoxu 100 × 100, beze změny z manuálu. */
export const KASA_MARK_SEGMENTS_PATH =
  "M30.56 8.31A46 46 0 0 1 69.44 8.31L58.03 32.78A19 19 0 0 0 41.97 32.78ZM76.38 12.32A46 46 0 0 1 95.82 45.99L68.93 48.34A19 19 0 0 0 60.90 34.44ZM95.82 54.01A46 46 0 0 1 76.38 87.68L60.90 65.56A19 19 0 0 0 68.93 51.66ZM69.44 91.69A46 46 0 0 1 30.56 91.69L41.97 67.22A19 19 0 0 0 58.03 67.22ZM23.62 87.68A46 46 0 0 1 4.18 54.01L31.07 51.66A19 19 0 0 0 39.10 65.56ZM4.18 45.99A46 46 0 0 1 23.62 12.32L39.10 34.44A19 19 0 0 0 31.07 48.34Z";

export const KASA_MARK_COIN = { cx: 50, cy: 50, r: 11 } as const;

export interface KasaOfficialText {
  id: "plna" | "kratka" | "akce" | "role" | "en";
  label: string;
  text: string;
}

export const KASA_OFFICIAL_TEXTS: KasaOfficialText[] = [
  { id: "plna", label: "Plná verze", text: "Financováno z komunitní kasy Spirit of TAP, z.s." },
  { id: "kratka", label: "Krátká verze", text: "Z komunitní kasy" },
  { id: "akce", label: "Akce", text: "Akci podpořila komunitní kasa Spirit of TAP, z.s." },
  { id: "role", label: "Komunitní role", text: "Role financovaná z komunitní kasy Spirit of TAP, z.s." },
  { id: "en", label: "Anglicky", text: "Funded by the Spirit of TAP community fund" },
];

export const KASA_CONTACT = {
  profileId: "4056f252-0b8e-4435-be86-b03af8b261c6",
  fallbackName: "Julie Holá",
} as const;
