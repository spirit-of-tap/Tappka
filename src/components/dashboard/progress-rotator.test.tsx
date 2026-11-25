import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProgressSlide } from '@/lib/dashboard/progress-slides';

import { ProgressRotator } from './progress-rotator';

const base: ProgressSlide = {
  id: 'knizni-body',
  title: 'Knižní body · 2. semestr',
  value: 3,
  goal: 10,
  studyTotal: 40,
  unit: 'b',
  ringLabel: '3 z 10 knižních bodů',
  headline: 'Zbývá 7 bodů',
  detail: 'Detail',
  href: '/cteni/prehled',
  linkLabel: 'Přehled',
  tone: 'violet',
};
const slides: ProgressSlide[] = [
  base,
  { ...base, id: 'zakaznicke-schuzky', title: 'Zákaznické schůzky · 2. semestr', tone: 'primary', ringLabel: '1 z 4 schůzek' },
];

describe('ProgressRotator', () => {
  it('renders the ring with its label', () => {
    render(<ProgressRotator slides={[base]} />);
    expect(screen.getByRole('img', { name: '3 z 10 knižních bodů' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rotaci/ })).not.toBeInTheDocument();
  });

  it('lets the user pause and resume auto-rotation', () => {
    render(<ProgressRotator slides={slides} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pozastavit rotaci' }));
    expect(screen.getByRole('button', { name: 'Spustit rotaci' })).toBeInTheDocument();
  });

  it('jumps to a slide from its dot', () => {
    render(<ProgressRotator slides={slides} />);
    fireEvent.click(screen.getByRole('button', { name: /Zákaznické schůzky/ }));
    expect(screen.getByRole('img', { name: '1 z 4 schůzek' })).toBeInTheDocument();
  });
});
