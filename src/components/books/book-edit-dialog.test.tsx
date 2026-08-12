import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookEditDialog } from './book-edit-dialog';
import type { BookWithProfiles } from '@/lib/books/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

function book(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1', title_cs: 'Sprint', title_en: null, author: 'Jake Knapp',
    description: null, book_points: null, list_status: 'processing',
    list_status_reason: null, page_count: 288, source: 'google_books',
    external_id: 'v1', google_books_cover_url: null, is_rocket_model: false,
    isbn_13: '9780593076118', created_at: '2026-08-01T10:00:00Z', created_by: null,
    list_status_changed_by: null, essay_count: 0, tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

describe('BookEditDialog', () => {
  it('preserves unsaved edits when swapping to the replace flow and back', async () => {
    render(
      <BookEditDialog
        book={book()}
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/název/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'X');
    expect(titleInput).toHaveValue('X');

    await userEvent.click(screen.getByRole('button', { name: /nahradit záznam/i }));

    await userEvent.click(screen.getByRole('button', { name: /zpět na úpravy/i }));

    expect(screen.getByLabelText(/název/i)).toHaveValue('X');
  });
});
