import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/ui/confetti', () => ({
  Confetti: () => null,
}));

import { BorrowPanel } from './borrow-panel';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderPanel = (props: Partial<Parameters<typeof BorrowPanel>[0]> = {}) =>
  render(
    <TooltipProvider>
      <BorrowPanel {...base} {...props} />
    </TooltipProvider>,
  );

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
});

const base = {
  bookId: 'book-1',
  title: 'Atomové návyky',
  author: 'James Clear',
  coverUrl: null,
  availableCopies: 2,
  totalCopies: 3,
};

describe('BorrowPanel', () => {
  it('renders the book and availability with an enabled borrow button', () => {
    render(<BorrowPanel {...base} />);
    expect(screen.getByText('Atomové návyky')).toBeInTheDocument();
    expect(screen.getByText('James Clear')).toBeInTheDocument();
    expect(screen.getByText('2 z 3 kopií je teď k dispozici.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Půjčit si/i })).toBeEnabled();
  });

  it('shows status badges next to the title when book status fields are passed', () => {
    renderPanel({
      book: { list_status: 'shortlist', is_rocket_model: true, highlight_category: null },
    });
    expect(screen.getByLabelText('Ověřená kniha')).toBeInTheDocument();
    expect(screen.getByLabelText('Rocket model')).toBeInTheDocument();
  });

  it('hides status badges when book status fields are not passed', () => {
    renderPanel({});
    expect(screen.queryByLabelText('Ověřená kniha')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rocket model')).not.toBeInTheDocument();
  });

  it('disables the borrow button when no copies are available', () => {
    render(<BorrowPanel {...base} availableCopies={0} />);
    expect(screen.getByText('Všech 3 kopií je momentálně půjčeno.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Půjčit si/i })).toBeDisabled();
  });

  it('shows the success state with the due date after borrowing', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { due_at: '2026-08-30T00:00:00.000Z' } }),
    } as Response);

    const user = userEvent.setup();
    render(<BorrowPanel {...base} />);
    await user.click(screen.getByRole('button', { name: /Půjčit si/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/library/books/book-1/borrow', { method: 'POST' });
    await waitFor(() => expect(screen.getByText('Kniha vypůjčena!')).toBeInTheDocument());
    expect(screen.getByText('30. srpna 2026')).toBeInTheDocument();
  });

  it('borrows the exact labelled copy opened from its QR code', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { due_at: '2026-08-30T00:00:00.000Z' } }),
    } as Response);

    const user = userEvent.setup();
    render(<BorrowPanel {...base} labelCode={7} availableCopies={1} totalCopies={1} />);

    expect(screen.getByText('Výtisk #007')).toBeInTheDocument();
    expect(screen.getByText('Tento výtisk je k dispozici.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Půjčit si/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/library/books/book-1/borrow?label=7', { method: 'POST' });
  });

  it('shows an error toast and returns to idle when borrowing fails', async () => {
    const toastModule = await import('sonner');
    const errorSpy = vi.spyOn(toastModule.toast, 'error').mockImplementation(() => '');
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Žádná dostupná kopie' }),
    } as Response);

    const user = userEvent.setup();
    render(<BorrowPanel {...base} />);
    await user.click(screen.getByRole('button', { name: /Půjčit si/i }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Žádná dostupná kopie'));
    expect(screen.getByRole('button', { name: /Půjčit si/i })).toBeEnabled();
  });

  it('shows the already-borrowed state with a due date and a return option', () => {
    render(<BorrowPanel {...base} initialDueAt="2026-08-30T00:00:00.000Z" />);
    expect(screen.getByText('Tuto knihu už máš vypůjčenou')).toBeInTheDocument();
    expect(screen.getByText('30. srpna 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vrátit/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Půjčit si/i })).not.toBeInTheDocument();
  });

  it('returns to the idle borrow state after returning the book', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) } as Response);

    const user = userEvent.setup();
    render(<BorrowPanel {...base} initialDueAt="2026-08-30T00:00:00.000Z" />);
    await user.click(screen.getByRole('button', { name: /Vrátit/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/library/books/book-1/return', { method: 'POST' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Půjčit si/i })).toBeInTheDocument());
    expect(screen.queryByText('Tuto knihu už máš vypůjčenou')).not.toBeInTheDocument();
  });
});
