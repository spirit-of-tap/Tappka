import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CteniTabBar } from './cteni-tab-bar';

const mockPathname = vi.fn(() => '/cteni/prehled');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

function renderBar(props?: Partial<{ isCoachOrAdmin: boolean; reviewCount: number }>) {
  return render(<CteniTabBar isCoachOrAdmin={false} reviewCount={0} {...props} />);
}

beforeEach(() => {
  mockPathname.mockReturnValue('/cteni/prehled');
});

describe('CteniTabBar', () => {
  it('shows only member areas without a coach role', () => {
    renderBar();

    expect(screen.getByRole('link', { name: 'Moje' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Objevovat' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kontrola/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Správa' })).not.toBeInTheDocument();
  });

  it('adds the coach work queues with a role', () => {
    renderBar({ isCoachOrAdmin: true });

    expect(screen.getByRole('link', { name: /Kontrola/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Správa' })).toBeInTheDocument();
  });

  it('marks exactly the current section root with aria-current', () => {
    mockPathname.mockReturnValue('/cteni/hledat');
    renderBar({ isCoachOrAdmin: true });

    expect(screen.getByRole('link', { name: 'Objevovat' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const currents = screen
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currents).toHaveLength(1);
  });

  it('highlights nothing on detail routes shared by several sections', () => {
    mockPathname.mockReturnValue('/cteni/knihy/some-id');
    renderBar({ isCoachOrAdmin: true });

    const currents = screen
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currents).toHaveLength(0);
  });

  it('carries the review count badge only while essays are waiting', () => {
    mockPathname.mockReturnValue('/cteni/sprava');
    const { rerender } = renderBar({ isCoachOrAdmin: true, reviewCount: 3 });

    // Accessible name includes the badge digits.
    expect(screen.getByRole('link', { name: /Kontrola/ })).toHaveTextContent('3');

    rerender(<CteniTabBar isCoachOrAdmin reviewCount={0} />);
    // At zero the badge disappears, leaving the bare label.
    expect(screen.getByRole('link', { name: 'Kontrola' })).toBeInTheDocument();
  });
});
