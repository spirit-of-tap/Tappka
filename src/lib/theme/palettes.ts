/** Colour palettes on top of the light/dark mode; CSS lives in globals.css under `[data-palette]`. */
export const PALETTES = [
  { id: 'tappka', label: 'Tappka', description: 'Krémová a červená, výchozí' },
  { id: 'les', label: 'Les', description: 'Klidná zelená' },
  { id: 'ocean', label: 'Oceán', description: 'Modrá, v tmavém režimu půlnoc' },
  { id: 'levandule', label: 'Levandule', description: 'Jemná fialová' },
  { id: 'merunka', label: 'Meruňka', description: 'Teplá oranžová' },
  { id: 'ruzova', label: 'Růžová', description: 'Svěží růžová' },
  { id: 'grafit', label: 'Grafit', description: 'Střídmá šedá, bez barev navíc' },
] as const

export type PaletteId = (typeof PALETTES)[number]['id'];

export const DEFAULT_PALETTE: PaletteId = 'tappka';
export const PALETTE_STORAGE_KEY = 'palette';
export const PALETTE_CHANGE_EVENT = 'tappka:palette';

export function isPalette(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

/** The default palette is the base tokens, so <html> carries no attribute for it. */
export function applyPalette(root: HTMLElement, palette: PaletteId): void {
  if (palette === DEFAULT_PALETTE) root.removeAttribute('data-palette');
  else root.setAttribute('data-palette', palette);
}

/** How dark the dark mode is; "dim" lifts every dark surface (`--shade-lift`). */
export const SHADES = [
  { id: 'classic', label: 'Klasický', description: 'Hluboký tmavý' },
  { id: 'dim', label: 'Tlumený', description: 'Světlejší tmavý, méně kontrastní' },
] as const

export type ShadeId = (typeof SHADES)[number]['id'];

export const DEFAULT_SHADE: ShadeId = 'classic';
export const SHADE_STORAGE_KEY = 'shade';

export function isShade(value: unknown): value is ShadeId {
  return SHADES.some((s) => s.id === value);
}

export function applyShade(root: HTMLElement, shade: ShadeId): void {
  if (shade === DEFAULT_SHADE) root.removeAttribute('data-shade');
  else root.setAttribute('data-shade', shade);
}

function bootLine(key: string, fallback: string, ids: readonly string[], attribute: string): string {
  return `try{var v=localStorage.getItem(${JSON.stringify(key)});if(v&&v!==${JSON.stringify(fallback)}&&${JSON.stringify(ids)}.indexOf(v)>-1)document.documentElement.setAttribute(${JSON.stringify(attribute)},v)}catch(e){}`;
}

/**
 * Inline <head> script: applies the stored palette and shade before first paint
 * so the page never flashes the default colours. Kept self-contained on purpose.
 */
export const PALETTE_BOOT_SCRIPT =
  bootLine(PALETTE_STORAGE_KEY, DEFAULT_PALETTE, PALETTES.map((p) => p.id), 'data-palette') +
  bootLine(SHADE_STORAGE_KEY, DEFAULT_SHADE, SHADES.map((s) => s.id), 'data-shade');
