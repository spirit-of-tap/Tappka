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
} satisfies Omit<import('@/lib/essays/types').EssayWithDetails, 'published_at'>;

const draftEssay = { ...baseEssay, published_at: null };
const publishedEssay = { ...baseEssay, published_at: '2026-08-01T10:00:00Z' };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy.mockReset();
  push.mockReset();
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