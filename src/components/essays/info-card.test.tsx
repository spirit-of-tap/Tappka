import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoCard } from '@/components/essays/info-card';

describe('InfoCard (eseje)', () => {
  it('explains the ATP requirement', () => {
    render(<InfoCard />);
    expect(screen.getAllByText(/ATP/).length).toBeGreaterThan(0);
    expect(screen.getByText(/nemusí být dokonalé literární dílo/)).toBeInTheDocument();
  });

  it('explains the 120-point reading goal and 1–3 points per essay', () => {
    render(<InfoCard />);
    expect(screen.getByText(/120 bodů/)).toBeInTheDocument();
    expect(screen.getByText(/1–3 body/)).toBeInTheDocument();
  });

  it('mentions the coach can send an essay back for rework', () => {
    render(<InfoCard />);
    expect(screen.getByText(/vrátit k přepracování/)).toBeInTheDocument();
  });
});