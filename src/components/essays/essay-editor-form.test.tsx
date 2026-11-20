import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { buildDraftKey } from '@/lib/editor-drafts/draft-storage';

const push = vi.fn();
const replace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
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
  frozen_book_points: null,
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

function saveButton() {
  return screen.getByRole('button', { name: 'Uložit' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy.mockReset();
  push.mockReset();
  replace.mockReset();
  mockSearchParams.delete('book');
  mockSearchParams.delete('source');
  // jsdom starts with a single history entry, so BackButton's fallback path
  // (router.replace) is what actually fires in these tests. Stub only
  // `length` — `history.replaceState` is still real and used by persist().
  Object.defineProperty(window.history, 'length', { value: 1, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EssayEditorForm — essay creation', () => {
  it('does not touch the network while the form is empty', async () => {
    render(<EssayEditorForm />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not save just from typing — only clicking Uložit does', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Atomic Habits');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(saveButton());

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
  });

  it('saves via Cmd/Ctrl+S as well as the button', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Atomic Habits');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
  });

  it('sends a renderable doc (not {}) when only the title was saved', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), '100M Offers');
    await user.click(saveButton());

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
    const payload = JSON.parse((fetchSpy.mock.calls.find(([url]) => url === '/api/essays')?.[1] as RequestInit).body as string);
    expect(payload.content_json).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});

describe('EssayEditorForm — save button', () => {
  it('is disabled until there is an unsaved change', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(saveButton()).toBeDisabled();
  });

  it('enables after a change and disables again once the save completes', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    expect(saveButton()).toBeEnabled();

    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });
});

describe('EssayEditorForm — save status', () => {
  it('shows a dirty indicator after a change, before saving', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    expect(screen.getByText('Neuložené změny')).toBeInTheDocument();
  });

  it('shows the saved state after clicking Uložit', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText(/Uloženo/)).toBeInTheDocument());
  });

  it('shows an error status after a failed save, and the same button retries it', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByText('Neuloženo')).toBeInTheDocument());
    expect(saveButton()).toBeEnabled();

    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    await user.click(saveButton());
    await waitFor(() => expect(screen.getByText(/Uloženo/)).toBeInTheDocument());
  });

  it('saves a title change on an existing essay when the author clicks Uložit', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { revision_no: 2, updated_at: '2026-08-10T12:00:00Z' } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    await user.click(saveButton());

    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([, init]) => init?.method === 'PATCH');
      expect(patches).toHaveLength(1);
    });
  });
});

describe('EssayEditorForm — no publish step', () => {
  it('has no publish button, but does have Uložit', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(screen.queryByRole('button', { name: 'Zveřejnit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeInTheDocument();
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
  it('briefly glows the save status right after a save completes, then settles', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<EssayEditorForm />);

    await user.type(screen.getByLabelText('Název eseje'), 'Titul');
    await user.click(saveButton());
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
  it('does not mark the essay dirty just from opening the editor', async () => {
    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await vi.advanceTimersByTimeAsync(5000);

    expect(saveButton()).toBeDisabled();
    expect(
      fetchSpy.mock.calls.some(([url]) => url === `/api/essays/${publishedEssay.id}`),
    ).toBe(false);
  });

  it('does not mark the essay dirty on mount under StrictMode', async () => {
    render(
      <StrictMode>
        <EssayEditorForm initialEssay={publishedEssay} />
      </StrictMode>,
    );
    await vi.advanceTimersByTimeAsync(5000);

    expect(saveButton()).toBeDisabled();
  });
});

describe('EssayEditorForm — content source', () => {
  it('lets the author search for and select a content source, then save it', async () => {
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

    // …and again once selected, in the same spot the book card shows them.
    expect(screen.getByText('0,50')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    await user.click(saveButton());

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

    await user.click(saveButton());
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

    await user.click(saveButton());
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

describe('EssayEditorForm — unsaved changes guard', () => {
  it('navigates back immediately via the Back button when there are no unsaved changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.click(screen.getByRole('button', { name: /Zpět/ }));

    expect(replace).toHaveBeenCalledWith('/cteni/prehled');
    expect(screen.queryByText(/Neuložené změny/)).not.toBeInTheDocument();
  });

  it('confirms before leaving via the Back button when there are unsaved changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    await user.click(screen.getByRole('button', { name: /Zpět/ }));

    expect(replace).not.toHaveBeenCalled();
    expect(await screen.findByText('Neuložené změny?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odejít bez uložení' }));
    expect(replace).toHaveBeenCalledWith('/cteni/prehled');
  });

  it('stays on the page when the author cancels the confirm dialog', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    await user.click(screen.getByRole('button', { name: /Zpět/ }));
    await user.click(screen.getByRole('button', { name: 'Zůstat' }));

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Neuložené změny?')).not.toBeInTheDocument();
  });

  it('confirms before leaving through an in-app link click elsewhere on the page', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <div>
        <a href="/cteni/prehled">Přehled</a>
        <EssayEditorForm initialEssay={draftEssay} />
      </div>,
    );

    await user.type(screen.getByLabelText('Název eseje'), ' upraveno');
    await user.click(screen.getByRole('link', { name: 'Přehled' }));

    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByText('Neuložené změny?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odejít bez uložení' }));
    expect(push).toHaveBeenCalledWith('/cteni/prehled');
  });
});

describe('EssayEditorForm — draft recovery', () => {
  const essayScope = 'essay:essay-1';

  function seedDraft(scope: string, savedAt: string, payload: Record<string, unknown>) {
    window.localStorage.setItem(buildDraftKey(scope), JSON.stringify({ savedAt, payload }));
  }

  const EMPTY_PAYLOAD = {
    title: '', contentJson: { type: 'doc' }, contentText: '',
    bookId: null, contentSourceId: null, book: null, contentSource: null,
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers to restore a newer draft and fills the form on Obnovit', async () => {
    seedDraft(essayScope, new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Obnovený název',
      contentText: 'Obnovený text',
    });
    fetchSpy.mockResolvedValue(jsonResponse({}, 200));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Název eseje')).toHaveValue('Obnovený název');

    // The mocked TiptapEditor is uncontrolled, so prove the restored prose
    // reached the form state by saving and inspecting the PATCH body.
    await user.click(saveButton());
    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays/essay-1');
      expect(patches).toHaveLength(1);
      const body = JSON.parse(String(patches[0][1]?.body)) as { content_text: string };
      expect(body.content_text).toBe('Obnovený text');
    });
  });

  it('renders with a tampered draft without crashing', async () => {
    seedDraft(essayScope, new Date().toISOString(), { title: 123, contentText: null });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Název eseje')).toHaveValue('');
  });

  it('Zahodit removes the stored draft and hides the banner', async () => {
    seedDraft(essayScope, new Date().toISOString(), EMPTY_PAYLOAD);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(buildDraftKey(essayScope))).toBeNull();
  });

  it('stays silent when the server copy is newer than the draft', async () => {
    // Both timestamps must stay inside the 14-day TTL, or the draft would be
    // dropped by expiry before the comparison ever runs.
    const now = Date.now();
    seedDraft(essayScope, new Date(now - 2 * 3_600_000).toISOString(), EMPTY_PAYLOAD);

    render(<EssayEditorForm initialEssay={{ ...draftEssay, updated_at: new Date(now - 3_600_000).toISOString() }} />);

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    // Suppression comes from the isDraftNewerThan comparison, not from
    // silently deleting the stored draft.
    expect(window.localStorage.getItem(buildDraftKey(essayScope))).not.toBeNull();
  });

  it('offers a draft on /nova, where no server copy exists', async () => {
    seedDraft('essay:nova:profile-1', new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Nový náčrt',
      contentText: 'text',
    });

    render(<EssayEditorForm profileId="profile-1" />);

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();
  });

  it('keeps /nova drafts separate per profile', async () => {
    seedDraft('essay:nova:profile-2', new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Cizí náčrt',
      contentText: 'text',
    });

    render(<EssayEditorForm profileId="profile-1" />);

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    // The other profile's draft is merely out of scope — it must survive.
    expect(window.localStorage.getItem(buildDraftKey('essay:nova:profile-2'))).not.toBeNull();
  });

  it('writes the draft to localStorage while typing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm profileId="profile-1" />);

    await user.type(screen.getByLabelText('Název eseje'), 'Rozepsaná esej');
    await vi.advanceTimersByTimeAsync(1500);

    const raw = window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).payload.title).toBe('Rozepsaná esej');
  });

  it('includes the selected book in the written draft', async () => {
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
      return Promise.resolve(jsonResponse({}, 200));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm profileId="profile-1" />);
    await user.type(screen.getByLabelText('Hledat knihu nebo jiný zdroj'), 'Atomic');
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByText('Atomic Habits')).toBeInTheDocument());
    await user.click(screen.getByText('Atomic Habits'));
    await vi.advanceTimersByTimeAsync(1500);

    const raw = window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'));
    expect(raw).not.toBeNull();
    const payload = JSON.parse(raw!).payload as { bookId: string | null; book: { id: string } | null };
    expect(payload.bookId).toBe('b1');
    expect(payload.book).toEqual(expect.objectContaining({ id: 'b1' }));
  });

  it('clears the draft once a save lands', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm profileId="profile-1" />);
    await user.type(screen.getByLabelText('Název eseje'), 'Uložená esej');
    await vi.advanceTimersByTimeAsync(1500);
    expect(window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'))).not.toBeNull();

    await user.click(saveButton());
    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'))).toBeNull();
    // migrate moves the draft to the essay scope; only the clear-on-save
    // discard removes it there. Without this assertion the test would pass
    // even if the discard effect were deleted.
    expect(window.localStorage.getItem(buildDraftKey('essay:essay-1'))).toBeNull();
  });

  it('clears the draft on an existing essay once a save lands', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 200));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);
    await user.type(screen.getByLabelText('Název eseje'), 'Uložená esej');
    await vi.advanceTimersByTimeAsync(1500);
    expect(window.localStorage.getItem(buildDraftKey(essayScope))).not.toBeNull();

    await user.click(saveButton());
    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays/essay-1');
      expect(patches).toHaveLength(1);
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(window.localStorage.getItem(buildDraftKey(essayScope))).toBeNull();
  });

  it('keeps the draft when a save fails', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'x' }, 500));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);
    await user.type(screen.getByLabelText('Název eseje'), 'Neuložený text');
    await vi.advanceTimersByTimeAsync(1500);
    expect(window.localStorage.getItem(buildDraftKey(essayScope))).not.toBeNull();

    await user.click(saveButton());
    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays/essay-1');
      expect(patches).toHaveLength(1);
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(window.localStorage.getItem(buildDraftKey(essayScope))).not.toBeNull();
  });
});
