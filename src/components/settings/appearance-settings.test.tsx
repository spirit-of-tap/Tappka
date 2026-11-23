import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppearanceSettings } from './appearance-settings';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'dark', setTheme }) }));

describe('AppearanceSettings', () => {
  afterEach(() => {
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
});
