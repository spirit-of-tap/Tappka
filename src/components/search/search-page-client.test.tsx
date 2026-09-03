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
    if (url.startsWith('/api/books?')) return Promise.resolve(jsonResponse({ data: books }));
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

describe('SearchPageClient — category subpages', () => {
  it('renders category subpage with themed banner, description, and switcher', async () => {
    mockSearchEndpoints({
      books: [{
        id: 'b1', title_cs: 'Radikální otevřenost', author: 'Kim Scott', google_books_cover_url: null,
        in_library: false, list_status: 'shortlist', is_rocket_model: false, highlight_category: null, tags: ['Leadership'],
      }],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchPageClient {...requiredProps} />);

    // Click on Leadership category card in the overview grid
    const leadershipCard = screen.getByRole('button', { name: /Leadership/i });
    await user.click(leadershipCard);

    // Verify category header with title and Czech description
    expect(await screen.findByRole('heading', { level: 2, name: 'Leadership' })).toBeInTheDocument();
    expect(screen.getByText('Vedení lidí, budování týmů a inspirativní vůdcovství')).toBeInTheDocument();

    // Verify category switcher pills are present
    expect(screen.getByRole('button', { name: /Finance & ekonomika/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marketing/i })).toBeInTheDocument();

    // Verify back navigation button
    const backBtn = screen.getByRole('button', { name: /Zpět na přehled/i });
    expect(backBtn).toBeInTheDocument();

    await user.click(backBtn);
    expect(await screen.findByText('Knihy podle kategorií')).toBeInTheDocument();
  });

  it('allows switching categories directly from the subpage horizontal switcher', async () => {
    mockSearchEndpoints({
      books: [],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchPageClient {...requiredProps} />);

    // Click on Marketing category
    await user.click(screen.getByRole('button', { name: /Marketing/i }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Marketing' })).toBeInTheDocument();
    expect(screen.getByText('Budování značky, porozumění trhu a zákaznická zkušenost')).toBeInTheDocument();

    // Switch to Osobní rozvoj using horizontal switcher
    const personalDevBtn = screen.getByRole('button', { name: /Osobní rozvoj/i });
    await user.click(personalDevBtn);

    expect(await screen.findByRole('heading', { level: 2, name: 'Osobní rozvoj' })).toBeInTheDocument();
    expect(screen.getByText('Návyky, mentální odolnost, sebereflexe a osobní růst')).toBeInTheDocument();
  });
});
