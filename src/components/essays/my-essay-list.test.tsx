import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyEssayList } from '@/components/essays/my-essay-list';
import type { EssayWithDetails } from '@/lib/essays/types';

function essay(overrides: Partial<EssayWithDetails> = {}): EssayWithDetails {
  return {
    id: 'essay-1',
    author_profile_id: 'profile-1',
    book_id: null,
    frozen_book_points: null,
    content_source_id: null,
    title: 'Zveřejněná esej',
    content_json: {},
    content_text: 'Text',
    published_at: '2026-08-01T10:00:00Z',
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
    ...overrides,
  };
}

describe('MyEssayList source buckets', () => {
  it('shows a content source essay with its title and points, not as "Nad rámec četby"', () => {
    const sourced = essay({
      id: 'essay-3',
      title: 'Co jsem si odnesl z Founders',
      content_source_id: 'src-1',
      content_source: {
        id: 'src-1',
        kind: 'podcast',
        title: 'Founders',
        creator: 'David Senra',
        points: 0.5,
        status: 'approved',
      },
    });

    render(<MyEssayList essays={[sourced]} />);

    expect(screen.getByText('Founders')).toBeInTheDocument();
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
    expect(screen.queryByText('Nad rámec četby')).not.toBeInTheDocument();
  });

  it('still shows "Nad rámec četby" for an essay with no source at all', () => {
    render(<MyEssayList essays={[essay()]} />);
    expect(screen.getByText('Nad rámec četby')).toBeInTheDocument();
  });
});

describe('MyEssayList comments', () => {
  it('shows the comment count on every essay, including zero', () => {
    render(
      <MyEssayList
        essays={[essay({ id: 'a', comment_count: 3 }), essay({ id: 'b', title: 'Druhá', comment_count: 0 })]}
      />,
    );

    expect(screen.getByLabelText('3 komentáře')).toBeInTheDocument();
    expect(screen.getByLabelText('0 komentářů')).toBeInTheDocument();
  });

  it('floats essays awaiting a reply to the top, flags them, and links to the comments', () => {
    render(
      <MyEssayList
        essays={[essay({ id: 'a', title: 'Bez komentáře' }), essay({ id: 'b', title: 'S komentářem', comment_count: 1 })]}
        awaitingReplyIds={new Set(['b'])}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('S komentářem');
    expect(links[0]).toHaveTextContent('Kouč:ka čeká na tvou odpověď');
    expect(links[0]).toHaveAttribute('href', '/cteni/eseje/b#komentare');
    expect(links[1]).not.toHaveTextContent('čeká na tvou odpověď');
    expect(links[1]).toHaveAttribute('href', '/cteni/eseje/a');
  });
});
