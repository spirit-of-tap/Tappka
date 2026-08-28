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

describe('EssayEditorForm — publishing', () => {
  it('publishes a koncept and navigates to the detail page', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);
    await user.click(screen.getByRole('button', { name: 'Zveřejnit' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/eseje/essay-1'));
    expect(fetchSpy.mock.calls.some(([url]) => url === '/api/essays/essay-1/publish')).toBe(true);
  });

  it('labels the action Uložit změny for a published essay', () => {
    render(<EssayEditorForm initialEssay={publishedEssay} />);
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeInTheDocument();
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
      if (typeof url === 'string' && url.startsWith('/api/content-sources/search')) {
        return Promise.resolve(jsonResponse({
          data: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }],
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
    await user.click(screen.getByRole('button', { name: 'Jiný zdroj' }));
    await user.type(screen.getByLabelText('Hledat jiný zdroj'), 'Founders');
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
  it('lets the author switch to "Jiný zdroj" and search for one', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/content-sources/search')) {
        return Promise.resolve(jsonResponse({
          data: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }],
        }));
      }
      return Promise.resolve(jsonResponse({ data: { id: 'essay-1' } }, 201));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.click(screen.getByRole('button', { name: 'Jiný zdroj' }));
    await user.type(screen.getByLabelText('Hledat jiný zdroj'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(screen.getByText('Founders')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Founders'));
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates.length).toBeGreaterThan(0);
      const payload = JSON.parse((creates[0][1] as RequestInit).body as string);
      expect(payload.content_source_id).toBe('src-1');
      expect(payload.book_id).toBeNull();
    });
  });
});

describe('EssayEditorForm — add-book entry', () => {
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

  it('does not show Nemůžeš najít knihu? before the author searches', () => {
    render(<EssayEditorForm initialEssay={draftEssay} />);
    expect(screen.queryByText('Nemůžeš najít knihu?')).not.toBeInTheDocument();
  });

  it('shows Nemůžeš najít knihu? only when a search comes up empty', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse({ data: [] })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Hledat knihu'), 'kniha co neexistuje');

    await waitFor(() => expect(screen.getByText('Nemůžeš najít knihu?')).toBeInTheDocument());
  });

  it('keeps Nemůžeš najít knihu? hidden while the search has matches', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse({ data: [searchHit] })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText('Hledat knihu'), 'Atomic');

    expect(await screen.findByText('Atomic Habits')).toBeInTheDocument();
    expect(screen.queryByText('Nemůžeš najít knihu?')).not.toBeInTheDocument();
  });

  it('does not show the Add Book CTA when a book is already selected', () => {
    render(
      <EssayEditorForm
        initialEssay={{ ...publishedEssay, book: { ...searchHit, book_points: 3 } }}
      />,
    );

    expect(screen.queryByText(/Přidat novou do BOBa/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nemůžeš najít knihu?')).not.toBeInTheDocument();
  });
});