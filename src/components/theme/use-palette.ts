'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  applyPalette,
  applyShade,
  DEFAULT_PALETTE,
  DEFAULT_SHADE,
  isPalette,
  isShade,
  PALETTE_CHANGE_EVENT,
  PALETTE_STORAGE_KEY,
  SHADE_STORAGE_KEY,
  type PaletteId,
  type ShadeId,
} from '@/lib/theme/palettes';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PALETTE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PALETTE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** A per-device appearance choice kept in localStorage and mirrored on <html>. */
function useStoredChoice<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
  apply: (root: HTMLElement, value: T) => void,
): [T, (value: T) => void] {
  const read = useCallback((): T => {
    try {
      const value = localStorage.getItem(key);
      return isValid(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback, isValid]);

  const value = useSyncExternalStore(subscribe, read, () => fallback);

  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // Private mode: the choice still applies for this page view.
      }
      apply(document.documentElement, next);
      window.dispatchEvent(new Event(PALETTE_CHANGE_EVENT));
    },
    [key, apply],
  );

  return [value, set];
}

export function usePalette(): [PaletteId, (palette: PaletteId) => void] {
  return useStoredChoice(PALETTE_STORAGE_KEY, DEFAULT_PALETTE, isPalette, applyPalette);
}

export function useShade(): [ShadeId, (shade: ShadeId) => void] {
  return useStoredChoice(SHADE_STORAGE_KEY, DEFAULT_SHADE, isShade, applyShade);
}
