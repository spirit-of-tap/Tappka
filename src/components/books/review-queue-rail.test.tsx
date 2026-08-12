import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReviewQueueRail } from './review-queue-rail';
import type { BookWithProfiles } from '@/lib/books/types';

function book(overrides: Partial<BookWithProfiles>): BookWithProfiles {
  return {
    id: 'b1',
    title_cs: 'Sprint',
    author: 'Jake Knapp',
    book_points: null,
    google_books_cover_url: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

const BOOKS = [
  book({ id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 2 }),
  book({ id: 'b2', title_cs: 'Ikigai', author: 'Héctor García' }),
];

describe('ReviewQueueRail', () => {
  it('lists every pending book with its author', () => {
    render(<ReviewQueueRail books={BOOKS} selectedId="b1" onSelect={vi.fn()} />);

    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.getByText('Jake Knapp')).toBeInTheDocument();
    expect(screen.getByText('Ikigai')).toBeInTheDocument();
  });

  it("does not show the AI score on the rail", () => {
    render(<ReviewQueueRail books={BOOKS} selectedId="b1" onSelect={vi.fn()} />);

    expect(screen.queryByText('2 b.')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('marks only the selected book as current', () => {
    render(<ReviewQueueRail books={BOOKS} selectedId="b2" onSelect={vi.fn()} />);

    const current = screen.getAllByRole('button').filter((el) => el.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Ikigai');
  });

  it('reports the clicked book to its parent', async () => {
    const onSelect = vi.fn();
    render(<ReviewQueueRail books={BOOKS} selectedId="b1" onSelect={onSelect} />);

    await userEvent.click(screen.getByText('Ikigai'));

    expect(onSelect).toHaveBeenCalledWith('b2');
  });
});
