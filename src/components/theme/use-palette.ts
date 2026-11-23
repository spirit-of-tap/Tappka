'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  applyPalette,
  DEFAULT_PALETTE,
  isPalette,
  PALETTE_CHANGE_EVENT,
  PALETTE_STORAGE_KEY,
  type PaletteId,
} from '@/lib/theme/palettes';

function read(): PaletteId {
  try {
    const value = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPalette(value) ? value : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PALETTE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PALETTE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Per-device colour palette, stored in localStorage and mirrored on <html>. */
export function usePalette(): [PaletteId, (palette: PaletteId) => void] {
  const palette = useSyncExternalStore(subscribe, read, () => DEFAULT_PALETTE);

  const setPalette = useCallback((next: PaletteId) => {
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Private mode: the palette still applies for this page view.
    }
    applyPalette(document.documentElement, next);
    window.dispatchEvent(new Event(PALETTE_CHANGE_EVENT));
  }, []);

  return [palette, setPalette];
}
