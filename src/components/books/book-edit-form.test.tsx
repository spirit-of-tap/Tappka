import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookEditForm } from './book-edit-form';
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

afterEach(() => vi.unstubAllGlobals());

describe('BookEditForm AI fetch', () => {
  it('fills title/author/description and title_en from /api/books/enrich without saving', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          title_cs: 'Sprint: Vyřešte největší problémy',
          title_en: 'Sprint: How to Solve Big Problems',
          author: 'Jake Knapp & John Zeratsky',
          description: 'Praktický průvodce.',
          tag: 'Inovace & kreativita',
          suggested_points: 3,
          points_reason: 'x',
          confidence: 'high',
          low_confidence_fields: [],
        },
      }),
    }));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje přes ai/i }));

    await waitFor(() => expect(screen.getByLabelText(/český název/i)).toHaveValue('Sprint: Vyřešte největší problémy'));
    expect(screen.getByLabelText(/anglický název/i)).toHaveValue('Sprint: How to Solve Big Problems');
    expect(screen.getByLabelText(/autor:ka/i)).toHaveValue('Jake Knapp & John Zeratsky');
    expect(screen.getByLabelText(/popis/i)).toHaveValue('Praktický průvodce.');

    const calls = vi.mocked(fetch).mock.calls;
    const patched = calls.filter(([url]) => String(url).includes('/api/books/') && !String(url).includes('/api/books/enrich'));
    expect(patched.length).toBe(0);
  });

  it('surfaces the budget error without touching fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Zkusil jsi to příliš mnohokrát. Zkus to za chvíli, nebo vyplň údaje ručně.' }),
    }));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje přes ai/i }));

    await waitFor(() => expect(screen.getByText(/zkusil jsi to příliš mnohokrát/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/český název/i)).toHaveValue('Sprint');
  });

  it('shows a generic error and leaves fields untouched when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje přes ai/i }));

    await waitFor(() => expect(screen.getByText(/nepodařilo se dohledat údaje/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/český název/i)).toHaveValue('Sprint');
  });
});

describe('BookEditForm Google refetch', () => {
  it('refetches cover and preview link via quick refetch without saving', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          cover_url: 'https://books.google.com/cover.jpg',
          preview_link: 'https://books.google.com/preview',
          isbn_13: '9781501121746',
          page_count: 288,
          external_id: 'vol-123',
        },
      }),
    }));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /rychle načíst/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/url obálky/i)).toHaveValue('https://books.google.com/cover.jpg')
    );
    expect(screen.getByLabelText(/odkaz na náhled/i)).toHaveValue('https://books.google.com/preview');

    const calls = vi.mocked(fetch).mock.calls;
    const patched = calls.filter(([url]) => String(url).includes('/api/books/') && !String(url).includes('google-refetch'));
    expect(patched.length).toBe(0);
  });

  it('opens Google Books picker and populates cover and preview link when a record is selected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'Sprint (Rozšířené vydání)',
            author: 'Jake Knapp',
            isbn_13: '9780593076199',
            description: 'Nové vydání',
            cover_url: 'https://books.google.com/picked-cover.jpg',
            page_count: 310,
            publisher: 'Simon & Schuster',
            published_year: 2020,
            preview_link: 'https://books.google.com/picked-preview',
            source: 'google_books',
            external_id: 'picked-vol-1',
          },
        ],
      }),
    }));

    render(<BookEditForm book={book({ isbn_13: null })} />);
    await userEvent.click(screen.getByRole('button', { name: /vybrat z google books/i }));

    // Verify modal opened
    expect(screen.getByRole('dialog', { name: /vybrat záznam z google books/i })).toBeInTheDocument();

    // Wait for candidate to appear and click 'Vybrat'
    const pickButton = await screen.findByRole('button', { name: /^vybrat$/i });
    await userEvent.click(pickButton);

    // Modal closes and form fields are updated
    await waitFor(() => {
      expect(screen.getByLabelText(/url obálky/i)).toHaveValue('https://books.google.com/picked-cover.jpg');
    });
    expect(screen.getByLabelText(/odkaz na náhled/i)).toHaveValue('https://books.google.com/picked-preview');
    expect(screen.getByLabelText(/isbn-13/i)).toHaveValue('9780593076199');
  });
});


