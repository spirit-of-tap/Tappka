import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LegacyPointsBadge } from './legacy-points-badge';

describe('LegacyPointsBadge', () => {
  it('renders staré label with lock icon', () => {
    render(<LegacyPointsBadge />);
    expect(screen.getByText('staré')).toBeInTheDocument();
  });

  it('renders unified segmented badge with points when provided', () => {
    render(<LegacyPointsBadge points={3} />);
    expect(screen.getByText('staré')).toBeInTheDocument();
    expect(screen.getByText('3 b.')).toBeInTheDocument();
  });

  it('formats decimal points properly', () => {
    render(<LegacyPointsBadge points={0.5} />);
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
  });

  it('respects a custom label', () => {
    render(<LegacyPointsBadge points={3} label="body" />);
    expect(screen.getByText('staré')).toBeInTheDocument();
    expect(screen.getByText('3 body')).toBeInTheDocument();
  });

  it('omits the points segment when points prop is undefined', () => {
    render(<LegacyPointsBadge />);
    expect(screen.getByText('staré')).toBeInTheDocument();
    expect(screen.queryByText(/b\./)).not.toBeInTheDocument();
  });
});
