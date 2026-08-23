import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveLoansCard } from './active-loans-card';
import type { BookLoanWithDetails } from '@/lib/library/types';
import type { BookWithProfiles } from '@/lib/books/types';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

const makeLoan = (overrides: Partial<BookLoanWithDetails> = {}): BookLoanWithDetails => ({
  id: 'loan-1',
  library_book_id: 'lib-1',
  borrower_id: 'user-1',
  borrowed_at: '2026-08-01T10:00:00.000Z',
  due_at: '2026-08-27T10:00:00.000Z',
  returned_at: null,
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-01T10:00:00.000Z',
  library_book: {
    id: 'lib-1',
    book_id: 'book-1',
    isbn_13: '9780132350884',
    created_by_profile_id: 'user-1',
    updated_by_profile_id: 'user-1',
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    book: {
      id: 'book-1',
      title_cs: 'Clean Code',
      title_en: null,
      author: 'Robert C. Martin',
      list_status: 'shortlist',
      is_rocket_model: false,
      highlight_category: null,
      book_points: 3,
      created_by: null,
      list_status_changed_by: null,
      essay_count: 0,
      created_at: '2026-08-01T10:00:00.000Z',
      description: null,
      google_books_cover_url: null,
      isbn_13: null,
      page_count: 400,
      preview_link: null,
      tags: [],
      source: 'manual',
      external_id: null,
      list_status_reason: null,
      highlight_category_id: null,
      list_status_changed_at: null,
      list_status_changed_by_profile_id: null,
      created_by_profile_id: 'user-1',
      updated_by_profile_id: 'user-1',
      updated_at: '2026-08-01T10:00:00.000Z',
    } as unknown as BookWithProfiles,
  },
  ...overrides,
});

beforeEach(() => {
  mockRefresh.mockReset();
});

describe('ActiveLoansCard', () => {
  it('renders nothing when loans array is empty', () => {
    const { container } = render(<ActiveLoansCard loans={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders active loan card with title, author, and return button', () => {
    const loan = makeLoan();
    render(
      <TooltipProvider>
        <ActiveLoansCard loans={[loan]} />
      </TooltipProvider>,
    );

    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('Robert C. Martin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vrátit/ })).toBeInTheDocument();
    expect(screen.getByText(/Půjčeno/)).toBeInTheDocument();
  });

  it('shows overdue status when due_at is in the past', () => {
    const overdueLoan = makeLoan({
      due_at: '2026-08-10T10:00:00.000Z',
    });
    render(
      <TooltipProvider>
        <ActiveLoansCard loans={[overdueLoan]} />
      </TooltipProvider>,
    );

    expect(screen.getByText('Po termínu')).toBeInTheDocument();
    expect(screen.getByText(/Po termínu vrácení/)).toBeInTheDocument();
  });

  it('shows history dialog trigger when returned loans exist', async () => {
    const user = userEvent.setup();
    const returnedLoan = makeLoan({
      id: 'loan-past',
      returned_at: '2026-08-15T10:00:00.000Z',
    });

    render(
      <TooltipProvider>
        <ActiveLoansCard loans={[returnedLoan]} />
      </TooltipProvider>,
    );

    const historyBtn = screen.getByRole('button', { name: /Historie výpůjček/ });
    expect(historyBtn).toBeInTheDocument();

    await user.click(historyBtn);
    expect(await screen.findByText('Historie výpůjček')).toBeInTheDocument();
  });
});
