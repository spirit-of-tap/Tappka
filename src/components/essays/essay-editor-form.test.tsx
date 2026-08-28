import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';

const push = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/essays/tiptap-editor', () => ({
  TiptapEditor: ({ onChange }: { onChange: (json: object, text: string) => void }) => (
    <textarea
      aria-label="Text eseje"
      onChange={(e) => onChange({ type: 'doc', content: [] }, e.target.value)}
    />
  ),
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseEssay = {
  id: 'essay-1',
  author_profile_id: 'profile-1',
  book_id: null,
  content_source_id: null,
  title: 'Atomic Habits',
  content_json: { type: 'doc', content: [] },
  content_text: 'Nějaký text',
  view_count: 0,
  vote_count: 0,
  comment_count: 0,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  author: null,
  book: null,
  content_source: null,
} satisfies Omit<import('@/lib/essays/types').EssayWithDetails, 'published_at'>;

const draftEssay = { ...baseEssay, published_at: null };
const publishedEssay = { ...baseEssay, published_at: '2026-08-01T10:00:00Z' };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy.mockReset();
  push.mockReset();
  mockSearchParams.delete('book');
  mockSearchParams.delete('source');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EssayEditorForm — koncept creation', () => {
  it('does not touch the network while the form is empty', async () => {
    render(<EssayEditorForm />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates the koncept exactly once on the first real change', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Atomic Habits');
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
  });
});

describe('EssayEditorForm — autosave status', () => {
  it('shows the saved state after a successful autosave', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => expect(screen.getByText(/Uloženo/)).toBeInTheDocument());
  });

  it('offers a retry after the save keeps failing', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await vi.advanceTimersByTimeAsync(10_000);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Zkusit znovu/ })).toBeInTheDocument(),
    );
  });

  it('autosaves a title change on an existing essay', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patches).toHaveLength(1);
    });
  });
});

describe('EssayEditorForm — no manual publish step', () => {
  it('has no publish or manual save button', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(screen.queryByRole('button', { name: 'Zveřejnit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Uložit změny' })).not.toBeInTheDocument();
  });

  it('tells the author saving happens automatically', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(screen.getByText('Ukládá se automaticky')).toBeInTheDocument();
  });

  it('labels deletion as a title-less essay before the author has typed a title', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={{ ...draftEssay, title: '' }} />);

    await user.click(screen.getByRole('button', { name: 'Další akce' }));
    expect(screen.getByRole('menuitem', { name: 'Smazat rozepsanou esej' })).toBeInTheDocument();
  });

  it('labels deletion as a full essay once the author has typed a title', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.click(screen.getByRole('button', { name: 'Další akce' }));
    expect(screen.getByRole('menuitem', { name: 'Smazat esej' })).toBeInTheDocument();
  });
});

describe('EssayEditorForm — header actions', () => {
  it('exposes version history as its own button, not tucked behind the menu', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: [] }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    expect(screen.getByRole('button', { name: 'Historie verzí' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Další akce' }));
    expect(screen.queryByRole('menuitem', { name: 'Historie verzí' })).not.toBeInTheDocument();
  });

  it('opens the version history sheet from its own button', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: [] }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.click(screen.getByRole('button', { name: 'Historie verzí' }));
    expect(await screen.findByText('Kontrolní body z tvého psaní. Náhled je jen ke čtení.')).toBeInTheDocument();
  });
});

describe('EssayEditorForm — save status glow', () => {
  it('briefly glows the save status right after an autosave completes, then settles', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<EssayEditorForm />);

    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => expect(screen.getByText(/Uloženo/)).toBeInTheDocument());

    expect(container.querySelector('.save-glow')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => expect(container.querySelector('.save-glow')).toBeNull());
  });

  it('does not glow before anything has been saved', () => {
    const { container } = render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(container.querySelector('.save-glow')).toBeNull();
  });
});

describe('EssayEditorForm — book preselect', () => {
  it('selects the book named in ?book= after returning from the add-book flow', async () => {
    mockSearchParams.set('book', 'new-1');
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: {
          id: 'new-1',
          title_cs: 'Sprint',
          author: 'Jake Knapp',
          book_points: 2,
          list_status: 'processing',
          is_rocket_model: false,
          google_books_cover_url: null,
          highlight_category: null,
        },
      }),
    );

    render(<EssayEditorForm initialEssay={draftEssay} />);

    await waitFor(() => expect(screen.getByText('Sprint')).toBeInTheDocument());
    expect(
      fetchSpy.mock.calls.some(([url]) => url === '/api/books/new-1'),
    ).toBe(true);
  });
});

describe('EssayEditorForm — content source preselect', () => {
  it('selects the source named in ?source= after returning from the add-source flow', async () => {
    mockSearchParams.set('source', 'src-1');
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: { id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
      }),
    );

    render(<EssayEditorForm initialEssay={draftEssay} />);

    await waitFor(() => expect(screen.getByText('Founders')).toBeInTheDocument());
    expect(
      fetchSpy.mock.calls.some(([url]) => url === '/api/content-sources/src-1'),
    ).toBe(true);
  });
});

describe('EssayEditorForm — mount behavior', () => {
  it('does not autosave an existing essay just from opening the editor', async () => {
    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await vi.advanceTimersByTimeAsync(5000);

    expect(
      fetchSpy.mock.calls.some(([url]) => url === `/api/essays/${publishedEssay.id}`),
    ).toBe(false);
  });
});

describe('EssayEditorForm — StrictMode double-invoke', () => {
  it('does not autosave on mount under StrictMode, but does autosave a real selection change', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/essays/source-search')) {
        return Promise.resolve(jsonResponse({
          data: { books: [], sources: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }] },
        }));
      }
      return Promise.resolve(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Rendering under <StrictMode> (which Next's App Router enables by
    // default) makes React double-invoke this effect on mount, on the same
    // component instance and the same ref — the exact scenario a
    // boolean "have I mounted" ref gets wrong (invocation 1 flips the
    // flag and returns; invocation 2 sees it already flipped and calls
    // `schedule()` anyway). The comparison-based guard sees identical
    // current-vs-stored selection values on both invocations, so it must
    // stay silent here regardless of how many times React runs it.
    render(
      <StrictMode>
        <EssayEditorForm initialEssay={publishedEssay} />
      </StrictMode>,
    );
    await vi.advanceTimersByTimeAsync(5000);

    expect(
      fetchSpy.mock.calls.some(([url]) => url === `/api/essays/${publishedEssay.id}`),
    ).toBe(false);

    // A genuine post-mount selection change must still schedule a save —
    // proving the guard isn't just permanently disabled.
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByText('Founders')).toBeInTheDocument());
    await user.click(screen.getByText('Founders'));
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([url]) => url === `/api/essays/${publishedEssay.id}`),
      ).toBe(true);
    });
  });
});

describe('EssayEditorForm — content source', () => {
  it('lets the author search for and select a content source', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/essays/source-search')) {
        return Promise.resolve(jsonResponse({
          data: { books: [], sources: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }] },
        }));
      }
      return Promise.resolve(jsonResponse({ data: { id: 'essay-1' } }, 201));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(screen.getByText('Founders')).toBeInTheDocument();
    });
    // Points show in the search result row, same as a book result would.
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();

    await user.click(screen.getByText('Founders'));
    await vi.advanceTimersByTimeAsync(3000);

    // …and again once selected, in the same spot the book card shows them.
    expect(screen.getByText('0,50')).toBeInTheDocument();

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates.length).toBeGreaterThan(0);
      const payload = JSON.parse((creates[0][1] as RequestInit).body as string);
      expect(payload.content_source_id).toBe('src-1');
      expect(payload.book_id).toBeNull();
    });
  });

  it('replaces a selected content source when the author picks a book instead', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/essays/source-search')) {
        return Promise.resolve(jsonResponse({
          data: {
            books: [{
              id: 'b1', title_cs: 'Atomic Habits', author: 'James Clear', book_points: 3,
              list_status: 'shortlist', is_rocket_model: false, google_books_cover_url: null, highlight_category: null,
            }],
            sources: [],
          },
        }));
      }
      return Promise.resolve(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const essayWithSource = {
      ...publishedEssay,
      content_source_id: 'src-1',
      content_source: {
        id: 'src-1',
        kind: 'podcast' as const,
        title: 'Founders',
        creator: 'David Senra',
        points: 0.5,
        status: 'approved' as const,
      },
    };

    render(<EssayEditorForm initialEssay={essayWithSource} />);
    expect(screen.getByText('Founders')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Atomic');
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());
    await user.click(screen.getByText('Atomic Habits'));

    // The old source is gone, not merely hidden behind another pane.
    expect(screen.queryByText('Founders')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => {
      const saves = fetchSpy.mock.calls.filter(([url]) => url === `/api/essays/${publishedEssay.id}`);
      expect(saves.length).toBeGreaterThan(0);
      const payload = JSON.parse((saves[0][1] as RequestInit).body as string);
      expect(payload.book_id).toBe('b1');
      expect(payload.content_source_id).toBeNull();
    });
  });

  it('replaces a selected book when the author picks a content source instead', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/essays/source-search')) {
        return Promise.resolve(jsonResponse({
          data: {
            books: [],
            sources: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }],
          },
        }));
      }
      return Promise.resolve(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const essayWithBook = {
      ...publishedEssay,
      book_id: 'b1',
      book: {
        id: 'b1',
        title_cs: 'Atomic Habits',
        author: 'James Clear',
        book_points: 3,
        list_status: 'shortlist' as const,
        is_rocket_model: false,
        google_books_cover_url: null,
        highlight_category: null,
      },
    };

    render(<EssayEditorForm initialEssay={essayWithBook} />);
    expect(screen.getByText('Atomic Habits')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByText('Founders')).toBeInTheDocument());
    await user.click(screen.getByText('Founders'));

    expect(screen.queryByText('Atomic Habits')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => {
      const saves = fetchSpy.mock.calls.filter(([url]) => url === `/api/essays/${publishedEssay.id}`);
      expect(saves.length).toBeGreaterThan(0);
      const payload = JSON.parse((saves[0][1] as RequestInit).body as string);
      expect(payload.content_source_id).toBe('src-1');
      expect(payload.book_id).toBeNull();
    });
  });
});

describe('EssayEditorForm — source not found', () => {
  const searchHit = {
    id: 'b1',
    title_cs: 'Atomic Habits',
    author: 'James Clear',
    book_points: 3,
    list_status: 'shortlist' as const,
    is_rocket_model: false,
    google_books_cover_url: null,
    highlight_category: null,
  };

  it('does not show the not-found card before the author searches', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(screen.queryByText('Přidat knihu')).not.toBeInTheDocument();
  });

  it('shows the not-found card only when a search comes up empty', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse({ data: { books: [], sources: [] } })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'kniha co neexistuje');

    await waitFor(() => expect(screen.getByText('Přidat knihu')).toBeInTheDocument());
    expect(screen.getByText('Přidat jiný zdroj')).toBeInTheDocument();
  });

  it('keeps the not-found card hidden while the search has matches', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse({ data: { books: [searchHit], sources: [] } })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Atomic');

    expect(await screen.findByText('Atomic Habits')).toBeInTheDocument();
    expect(screen.queryByText('Přidat knihu')).not.toBeInTheDocument();
  });

  it('does not show the not-found card when a book is already selected', () => {
    render(
      <EssayEditorForm
        initialEssay={{ ...publishedEssay, book: { ...searchHit, book_points: 3 } }}
      />,
    );

    expect(screen.queryByText('Přidat knihu')).not.toBeInTheDocument();
  });
});