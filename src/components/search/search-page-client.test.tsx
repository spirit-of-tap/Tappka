import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchPageClient } from './search-page-client';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const requiredProps = {
  popularEssays: [],
  categoryBestBooks: {},
  rocketModelBooks: [],
  highlightedByCategory: [],
};

function mockSearchEndpoints({
  essays = [],
  books = [],
  sources = [],
}: {
  essays?: unknown[];
  books?: unknown[];
  sources?: unknown[];
} = {}) {
  fetchSpy.mockImplementation((input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.startsWith('/api/essays')) return Promise.resolve(jsonResponse({ data: essays }));
    if (url.startsWith('/api/books/search')) return Promise.resolve(jsonResponse({ data: books }));
    if (url.startsWith('/api/content-sources')) return Promise.resolve(jsonResponse({ data: sources }));
    throw new Error(`unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchPageClient — search results', () => {
  it('fetches and shows content sources alongside books and essays', async () => {
    mockSearchEndpoints({
      sources: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchPageClient {...requiredProps} />);
    await user.type(screen.getByPlaceholderText('Hledat eseje, knihy, témata…'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).startsWith('/api/content-sources'))).toBe(true);
    });
    expect(await screen.findByText('Ostatní zdroje (1)')).toBeInTheDocument();
    expect(screen.getByText('Founders')).toBeInTheDocument();
  });

  it('shows "Žádné výsledky" only when books, essays, and sources are all empty', async () => {
    mockSearchEndpoints();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchPageClient {...requiredProps} />);
    await user.type(screen.getByPlaceholderText('Hledat eseje, knihy, témata…'), 'nic takového');
    await vi.advanceTimersByTimeAsync(400);

    expect(await screen.findByText('Žádné výsledky')).toBeInTheDocument();
  });

  it('does not show the sources section when there are none, even with other results', async () => {
    mockSearchEndpoints({
      books: [{
        id: 'b1', title_cs: 'Atomic Habits', author: 'James Clear', google_books_cover_url: null,
        in_library: true, list_status: 'shortlist', is_rocket_model: false, highlight_category: null,
      }],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchPageClient {...requiredProps} />);
    await user.type(screen.getByPlaceholderText('Hledat eseje, knihy, témata…'), 'Atomic');
    await vi.advanceTimersByTimeAsync(400);

    expect(await screen.findByText('Atomic Habits')).toBeInTheDocument();
    expect(screen.queryByText(/Ostatní zdroje/)).not.toBeInTheDocument();
  });
});
