import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { buildDraftKey } from '@/lib/editor-drafts/draft-storage';
import type { EssayWithDetails } from '@/lib/essays/types';

const push = vi.fn();
const replace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => mockSearchParams,
}));

const SERVER_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uložený text' }] }],
};
const DRAFT_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'obnovený text' }] }],
};

const baseEssay = {
  id: 'essay-1',
  author_profile_id: 'profile-1',
  book_id: null,
  frozen_book_points: null,
  content_source_id: null,
  title: 'Atomic Habits',
  content_json: SERVER_DOC,
  content_text: 'uložený text',
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
  published_at: null,
} satisfies EssayWithDetails;

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  replace.mockReset();
});

describe('EssayEditorForm restore with the real editor', () => {
  it('shows the restored draft in the editor after Obnovit', async () => {
    window.localStorage.setItem(buildDraftKey('essay:essay-1'), JSON.stringify({
      savedAt: new Date().toISOString(),
      payload: {
        title: 'Obnovený název',
        contentJson: DRAFT_DOC,
        contentText: 'obnovený text',
        bookId: null,
        contentSourceId: null,
        book: null,
        contentSource: null,
      },
    }));
    const user = userEvent.setup();
    render(<EssayEditorForm initialEssay={baseEssay} />);

    expect(screen.getByText('uložený text')).toBeInTheDocument();
    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));

    // The visible editor must show the restored content, not the server copy.
    expect(await screen.findByText('obnovený text')).toBeInTheDocument();
    expect(screen.queryByText('uložený text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Název eseje')).toHaveValue('Obnovený název');
  });
});
