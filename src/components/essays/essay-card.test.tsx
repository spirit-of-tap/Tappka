import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EssayCard } from './essay-card';
import type { EssayWithDetails } from '@/lib/essays/types';

const baseEssay = {
  id: 'essay-1',
  author_profile_id: 'profile-1',
  book_id: null,
  frozen_book_points: null,
  content_source_id: null,
  title: 'O čem podcast mluvil',
  content_json: {},
  content_text: 'Nějaký text',
  published_at: '2026-08-01T10:00:00Z',
  view_count: 3,
  vote_count: 1,
  comment_count: 0,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  author: { id: 'profile-1', name: 'Anna', picture: null, role: 'student', team_id: null },
  book: null,
  content_source: null,
} satisfies EssayWithDetails;

describe('EssayCard — content source', () => {
  it('shows the content source title and points', () => {
    render(
      <EssayCard
        essay={{
          ...baseEssay,
          content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
        }}
      />,
    );

    expect(screen.getByText('Founders')).toBeInTheDocument();
    // formatPoints always renders two decimals for a non-integer value.
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
  });

  it('uses the source kind icon in the source row instead of a book glyph', () => {
    const { container } = render(
      <EssayCard
        essay={{
          ...baseEssay,
          content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
        }}
      />,
    );

    // The cover tile and the source row both speak "podcast"…
    expect(container.querySelectorAll('.lucide-podcast')).toHaveLength(2);
    // …and nothing on the card claims this essay came from a book.
    expect(container.querySelector('.lucide-book-open')).toBeNull();
  });

  it('still shows "Nad rámec četby" when neither source is set', () => {
    render(<EssayCard essay={baseEssay} />);
    expect(screen.getByText('Nad rámec četby')).toBeInTheDocument();
  });
});
