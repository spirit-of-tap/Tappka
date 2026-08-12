import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FlowMap } from './flow-map';

describe('FlowMap', () => {
  it('renders all four stages in both variants', () => {
    const { rerender } = render(<FlowMap active="gate" variant="expanded" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);

    rerender(<FlowMap active="review" variant="compact" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('marks the active stage as the current step', () => {
    render(<FlowMap active="enriching" variant="compact" />);

    const items = screen.getAllByRole('listitem');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[3]).not.toHaveAttribute('aria-current');
  });

  it('distinguishes completed stages from upcoming ones', () => {
    render(<FlowMap active="enriching" variant="expanded" />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-state', 'done');
    expect(items[1]).toHaveAttribute('data-state', 'done');
    expect(items[2]).toHaveAttribute('data-state', 'current');
    expect(items[3]).toHaveAttribute('data-state', 'upcoming');
  });

  it('names every stage even when only the current one is visible', () => {
    render(<FlowMap active="search" variant="compact" />);

    for (const label of ['Pravidla', 'Najdi knihu', 'Tappka to doplní', 'Odeslat ke schválení']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('explains what happens at each stage in the expanded variant only', () => {
    const { rerender } = render(<FlowMap active="gate" variant="expanded" />);
    expect(screen.getByText('Popis, údaje a body')).toBeInTheDocument();

    rerender(<FlowMap active="gate" variant="compact" />);
    expect(screen.queryByText('Popis, údaje a body')).not.toBeInTheDocument();
  });
});
