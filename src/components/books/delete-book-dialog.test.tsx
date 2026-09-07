import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteBookDialog } from './delete-book-dialog';
import type { BookWithProfiles } from '@/lib/books/types';

function makeBook(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1',
    title_cs: 'Konec prokrastinace',
    title_en: 'The End of Procrastination',
    author: 'Petr Ludwig',
    description: null,
    book_points: null,
    list_status: 'processing',
    list_status_reason: null,
    page_count: 272,
    source: 'google_books',
    external_id: 'v1',
    google_books_cover_url: null,
    is_rocket_model: false,
    isbn_13: '9788087270516',
    created_at: '2026-08-01T10:00:00Z',
    created_by: null,
    list_status_changed_by: null,
    essay_count: 0,
    tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

afterEach(() => vi.unstubAllGlobals());

describe('DeleteBookDialog', () => {
  it('handles standard deletion when mode="delete" and essay count is 0', async () => {
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
        if (url.includes('/essays-count')) {
          return { ok: true, json: async () => ({ data: { count: 0 } }) };
        }
        if (opts?.method === 'DELETE') {
          return { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: false };
      }),
    );

    render(
      <DeleteBookDialog
        book={makeBook()}
        open={true}
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
        mode="delete"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/k této knize nejsou navázány žádné eseje/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /^smazat$/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('b1');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    const calls = vi.mocked(fetch).mock.calls;
    const deleteCall = calls.find(([url, opts]) => String(url) === '/api/books/b1' && opts?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall?.[1]?.body as string)).toEqual({});
  });

  it('handles duplicate mode by requiring original book selection and rerouting essays', async () => {
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();

    const originalBook = makeBook({
      id: 'orig-1',
      title_cs: 'Konec prokrastinace (Originál)',
      author: 'Petr Ludwig',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
        if (url.includes('/essays-count')) {
          return { ok: true, json: async () => ({ data: { count: 3 } }) };
        }
        if (url.includes('/api/books?')) {
          return { ok: true, json: async () => ({ data: [originalBook] }) };
        }
        if (opts?.method === 'DELETE') {
          return { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: false };
      }),
    );

    render(
      <DeleteBookDialog
        book={makeBook()}
        open={true}
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
        mode="duplicate"
      />,
    );

    expect(screen.getByText(/označit knihu jako duplikát/i)).toBeInTheDocument();

    // Confirm button should say 'Vyberte originální knihu' and be disabled
    const disabledConfirm = screen.getByRole('button', { name: /vyberte originální knihu/i });
    expect(disabledConfirm).toBeDisabled();

    // Wait for essays-count check to complete and search input to appear
    const searchInput = await screen.findByPlaceholderText(/hledat originální knihu podle názvu nebo autora/i);
    await userEvent.type(searchInput, 'Petr');

    // Candidate appears
    const candidateItem = await screen.findByText('Konec prokrastinace (Originál)');
    await userEvent.click(candidateItem);

    // Confirm button updates and enables
    const mergeButton = screen.getByRole('button', { name: /sloučit a smazat duplikát/i });
    expect(mergeButton).toBeEnabled();

    await userEvent.click(mergeButton);

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('b1');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    const calls = vi.mocked(fetch).mock.calls;
    const deleteCall = calls.find(([url, opts]) => String(url) === '/api/books/b1' && opts?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall?.[1]?.body as string)).toEqual({ reroute_to_book_id: 'orig-1' });
  });
});
