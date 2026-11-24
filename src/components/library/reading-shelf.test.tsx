import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingShelf } from './reading-shelf';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import type { BookLoanWithDetails } from '@/lib/library/types';

const makeLoan = (overrides: Partial<BookLoanWithDetails> = {}, cover: string | null = null): BookLoanWithDetails =>
  ({
    id: 'loan-1',
    due_at: '2026-12-12T10:00:00.000Z',
    returned_at: null,
    library_book: {
      id: 'lib-1',
      book_id: 'book-1',
      book: {
        id: 'book-1',
        title_cs: 'Clean Code',
        author: 'Robert C. Martin',
        google_books_cover_url: cover,
      },
    },
    ...overrides,
  }) as unknown as BookLoanWithDetails;

describe('ReadingShelf', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-05T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an empty state with a link to find a book', () => {
    render(<ReadingShelf loans={[]} />);

    expect(screen.getByText('Zrovna nic nečteš')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Najít knihu' })).toHaveAttribute('href', '/cteni/knihy');
    expect(screen.queryByRole('button', { name: /Historie/ })).not.toBeInTheDocument();
  });

  it('shows a spine card with the title and the due date, linking to the book', () => {
    render(<ReadingShelf loans={[makeLoan()]} />);

    const link = screen.getByRole('link', { name: 'Clean Code' });
    expect(link).toHaveAttribute('href', '/cteni/knihy/book-1');
    expect(link).toHaveTextContent('Vrátit do 12. 12.');
  });

  it('marks an overdue loan', () => {
    render(<ReadingShelf loans={[makeLoan({ due_at: '2026-12-01T10:00:00.000Z' })]} />);

    expect(screen.getByText('Po termínu od 1. 12.')).toHaveClass('text-destructive-strong');
  });

  it('opens the history of returned loans', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<ReadingShelf loans={[makeLoan({ id: 'past', returned_at: '2026-08-15T10:00:00.000Z' })]} />);

    await user.click(screen.getByRole('button', { name: 'Historie výpůjček (1)' }));
    expect(await screen.findByText(/Knihy, které jsi v minulosti vrátil/)).toBeInTheDocument();
  });
});
