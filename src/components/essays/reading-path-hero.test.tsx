import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReadingPathHero } from './reading-path-hero';
import type { EssayWithDetails } from '@/lib/essays/types';

function creditedEssay(bookId: string, title: string, points: number, publishedAt: string): EssayWithDetails {
  return {
    id: `e-${bookId}`,
    published_at: publishedAt,
    removed_at: null,
    frozen_book_points: null,
    title: 'Esej',
    book: { id: bookId, title_cs: title, author: 'A', book_points: points, list_status: 'longlist' },
    content_source: null,
  } as unknown as EssayWithDetails;
}

const stats = (approved: number, pending: number, essays: number) => ({
  approved_points: approved,
  pending_points: pending,
  essay_count: essays,
});

describe('ReadingPathHero', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an empty path without essays', () => {
    render(<ReadingPathHero stats={stats(0, 0, 0)} essays={[]} onboardingYear={2026} />);

    expect(screen.getByRole('heading', { name: 'Cesta 1. semestrem' })).toBeInTheDocument();
    expect(screen.getByText(/z 20 bodů/)).toBeInTheDocument();
    expect(screen.getByText('20 · cíl semestru')).toBeInTheDocument();
    expect(screen.getByText('zbývá 68 dní')).toBeInTheDocument();
    expect(screen.getByText('Za celé studium')).toBeInTheDocument();
    expect(screen.getByText('Zatím žádné eseje')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Milníky semestru' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cíl splněn')).not.toBeInTheDocument();
  });

  it('marks credited essays and pending books', () => {
    render(
      <ReadingPathHero
        stats={stats(5, 2, 4)}
        onboardingYear={2026}
        essays={[
          creditedEssay('b1', 'Clean Code', 2, '2026-10-01T10:00:00Z'),
          creditedEssay('b2', 'Rework', 3, '2026-10-20T10:00:00Z'),
        ]}
      />,
    );

    expect(screen.getByText('+2 čeká')).toBeInTheDocument();
    expect(screen.getByText('4 eseje · 2 knihy čekají na schválení')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Milníky semestru' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Clean Code: 2 body, celkem 2 z 20');
    expect(items[1]).toHaveTextContent('Rework: 3 body, celkem 5 z 20');
    expect(items[2]).toHaveTextContent('+2 čeká na schválení');
  });

  it('shows the goal badge and drops the pending marker once the target is exceeded', () => {
    render(
      <ReadingPathHero
        stats={stats(22, 1, 9)}
        onboardingYear={2026}
        essays={[creditedEssay('b1', 'Clean Code', 3, '2026-10-01T10:00:00Z')]}
      />,
    );

    expect(screen.getByText('Cíl splněn')).toBeInTheDocument();
    expect(screen.queryByText(/čeká$/)).not.toBeInTheDocument();
  });

  it('keeps the visual path out of the accessibility tree', () => {
    const { container } = render(
      <ReadingPathHero
        stats={stats(2, 0, 1)}
        onboardingYear={2026}
        essays={[creditedEssay('b1', 'Clean Code', 2, '2026-10-01T10:00:00Z')]}
      />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('Clean Code');
  });
});
