import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EssayVisualDiff } from './essay-visual-diff';
import { EssayViewerWithDiff } from './essay-viewer-with-diff';
import type { EssayWithDetails, EssayCommentWithAuthor } from '@/lib/essays/types';
import type { EssayFullRevision } from '@/lib/essays/queries';

describe('EssayVisualDiff', () => {
  it('highlights added and removed words accurately', () => {
    const oldText = 'Začali jsme testovat náš produkt bez jakýchkoliv metrik.';
    const newText = 'Začali jsme testovat náš produkt s 10 hloubkovými rozhovory a měřením NPS.';

    render(<EssayVisualDiff oldText={oldText} newText={newText} />);

    expect(screen.getByText('bez')).toBeInTheDocument();
    expect(screen.getByText('jakýchkoliv')).toBeInTheDocument();
    expect(screen.getByText('metrik')).toBeInTheDocument();
    expect(screen.getByText('hloubkovými rozhovory a měřením NPS')).toBeInTheDocument();
    expect(screen.getByText('Přidáno')).toBeInTheDocument();
    expect(screen.getByText('Odebráno')).toBeInTheDocument();
  });

  it('renders no-change message when old and new texts are identical', () => {
    const text = 'Stejný text v obou verzích.';
    render(<EssayVisualDiff oldText={text} newText={text} />);

    expect(
      screen.getByText('V textu nebyly nalezeny žádné změny oproti předchozí verzi.'),
    ).toBeInTheDocument();
  });
});

describe('EssayViewerWithDiff', () => {
  const essay: EssayWithDetails = {
    id: 'essay-1',
    author_profile_id: 'user-1',
    book_id: 'book-1',
    title: 'Moje esej',
    content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nová verze textu po úpravě.' }] }] },
    content_text: 'Nová verze textu po úpravě.',
    published_at: '2026-08-20T10:00:00Z',
    view_count: 5,
    vote_count: 2,
    comment_count: 1,
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-23T15:00:00Z',
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    author: { id: 'user-1', name: 'Student', picture: null, role: 'student', team_id: 'team-1' },
    book: null,
  };

  const coachComment: EssayCommentWithAuthor = {
    id: 'comment-coach',
    essay_id: 'essay-1',
    author_profile_id: 'coach-1',
    parent_id: null,
    body: 'Doporučuji doplnit testování.',
    created_at: '2026-08-21T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z',
    removed_at: null,
    author: { id: 'coach-1', name: 'Kouč Petr', picture: null, role: 'coach' },
  };

  const revisions: EssayFullRevision[] = [
    {
      revision_no: 1,
      title: 'Moje esej',
      content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Původní verze textu.' }] }] },
      content_text: 'Původní verze textu.',
      created_at: '2026-08-20T10:00:00Z',
      updated_at: '2026-08-20T10:00:00Z',
    },
    {
      revision_no: 2,
      title: 'Moje esej',
      content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nová verze textu po úpravě.' }] }] },
      content_text: 'Nová verze textu po úpravě.',
      created_at: '2026-08-23T15:00:00Z',
      updated_at: '2026-08-23T15:00:00Z',
    },
  ];

  it('shows alert banner and toggles diff view when essay was modified after coach comment', () => {
    render(
      <EssayViewerWithDiff
        essay={essay}
        comments={[coachComment]}
        revisions={revisions}
        currentProfileId="coach-1"
      />,
    );

    // Banner is visible
    expect(screen.getByText(/Esej byla upravena po komentáři kouče:ky/)).toBeInTheDocument();

    const diffButton = screen.getByRole('button', { name: /Zobrazit provedené změny \(Diff\)/i });
    expect(diffButton).toBeInTheDocument();

    // Click diff button
    fireEvent.click(diffButton);

    // Diff view is now rendered
    expect(screen.getByText(/Původní/)).toBeInTheDocument();
    expect(screen.getByText(/Nová/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zobrazit aktuální text/i })).toBeInTheDocument();
  });
});
