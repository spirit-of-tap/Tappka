/** Colour palettes on top of the light/dark mode; CSS lives in globals.css under `[data-palette]`. */
export const PALETTES = [
  { id: 'tappka', label: 'Tappka', description: 'Krémová a červená, výchozí' },
  { id: 'les', label: 'Les', description: 'Klidná zelená' },
  { id: 'ocean', label: 'Oceán', description: 'Modrá, v tmavém režimu půlnoc' },
  { id: 'levandule', label: 'Levandule', description: 'Jemná fialová' },
  { id: 'merunka', label: 'Meruňka', description: 'Teplá oranžová' },
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

/**
 * Inline <head> script: applies the stored palette before first paint so the
 * page never flashes the default colours. Kept self-contained on purpose.
 */
export const PALETTE_BOOT_SCRIPT = `try{var p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});if(p&&p!==${JSON.stringify(DEFAULT_PALETTE)}&&${JSON.stringify(PALETTES.map((x) => x.id))}.indexOf(p)>-1)document.documentElement.setAttribute('data-palette',p)}catch(e){}`;
