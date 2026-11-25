import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppearanceSettings } from './appearance-settings';

const setTheme = vi.fn();
const themeState = { theme: 'dark', resolvedTheme: 'dark' };
vi.mock('next-themes', () => ({ useTheme: () => ({ ...themeState, setTheme }) }));

describe('AppearanceSettings', () => {
  afterEach(() => {
    setTheme.mockClear();
    themeState.theme = 'dark';
    themeState.resolvedTheme = 'dark';
    localStorage.clear();
    document.documentElement.removeAttribute('data-palette');
  });

  it('marks the current mode and switches it', () => {
    render(<AppearanceSettings />);
    expect(screen.getByRole('radio', { name: /Tmavý/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: /Světlý/ }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('stores the chosen palette and applies it to the page', () => {
    render(<AppearanceSettings />);
    expect(screen.getByRole('radio', { name: /Tappka/ })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: /Les/ }));

    expect(localStorage.getItem('palette')).toBe('les');
    expect(document.documentElement.getAttribute('data-palette')).toBe('les');
    expect(screen.getByRole('radio', { name: /Les/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to the dim dark shade', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: /Tlumený/ }));
    expect(localStorage.getItem('shade')).toBe('dim');
    expect(document.documentElement.getAttribute('data-shade')).toBe('dim');
    document.documentElement.removeAttribute('data-shade');
  });

  it('keeps the theme when the shade is picked in dark mode', () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: /Tlumený/ }));
    expect(setTheme).not.toHaveBeenCalled();
    document.documentElement.removeAttribute('data-shade');
  });

  it('switches to dark when a shade is picked while the system resolves to light', () => {
    themeState.theme = 'system';
    themeState.resolvedTheme = 'light';
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole('radio', { name: /Tlumený/ }));
    expect(setTheme).toHaveBeenCalledWith('dark');
    document.documentElement.removeAttribute('data-shade');
  });

  it('re-applies the palette to the page when another tab changes it', () => {
    render(<AppearanceSettings />);
    localStorage.setItem('palette', 'les');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'palette' }));
    });
    expect(document.documentElement.getAttribute('data-palette')).toBe('les');
  });
});
