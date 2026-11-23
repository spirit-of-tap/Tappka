// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { applyPalette, applyShade, isPalette, PALETTE_BOOT_SCRIPT } from './palettes';

describe('palettes', () => {
  it('recognises known palette ids only', () => {
    expect(isPalette('les')).toBe(true);
    expect(isPalette('neon')).toBe(false);
  });

  it('sets the attribute for a palette and drops it for the default', () => {
    const root = document.createElement('html');
    applyPalette(root, 'ocean');
    expect(root.getAttribute('data-palette')).toBe('ocean');
    applyPalette(root, 'tappka');
    expect(root.hasAttribute('data-palette')).toBe(false);
  });

  it('boot script applies a stored palette and ignores unknown values', () => {
    localStorage.setItem('palette', 'les');
    new Function(PALETTE_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-palette')).toBe('les');

    document.documentElement.removeAttribute('data-palette');
    localStorage.setItem('palette', 'x" onload="');
    new Function(PALETTE_BOOT_SCRIPT)();
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false);
    localStorage.clear();
  });

  it('applies the dim shade and drops it for the classic one', () => {
    const root = document.createElement('html');
    applyShade(root, 'dim');
    expect(root.getAttribute('data-shade')).toBe('dim');
    applyShade(root, 'classic');
    expect(root.hasAttribute('data-shade')).toBe(false);

    localStorage.setItem('shade', 'dim');
    new Function(PALETTE_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-shade')).toBe('dim');
    document.documentElement.removeAttribute('data-shade');
    localStorage.clear();
  });
});
