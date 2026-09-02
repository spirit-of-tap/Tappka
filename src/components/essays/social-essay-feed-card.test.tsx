import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialEssayFeedCard } from './social-essay-feed-card';
import type { EssayWithDetails } from '@/lib/essays/types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockEssay: EssayWithDetails = {
  id: 'essay-10',
  author_profile_id: 'p1',
  book_id: 'b1',
  frozen_book_points: null,
  content_source_id: null,
  title: 'Jak postavit MVP za víkend podle Lean Startup',
  content_json: {},
  content_text: 'Po přečtení knihy jsme v týmu udělali první experiment a za 48 hodin jsme získali první platící zákazníky.',
  published_at: '2026-08-20T10:00:00Z',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  view_count: 15,
  vote_count: 6,
  comment_count: 3,
  author: {
    id: 'p1',
    name: 'Lukáš Dvořák',
    picture: null,
    role: 'student',
    team_id: 't1',
  },
  book: {
    id: 'b1',
    title_cs: 'The Lean Startup',
    author: 'Eric Ries',
    book_points: 2,
    list_status: 'shortlist',
    is_rocket_model: false,
    google_books_cover_url: null,
    highlight_category: null,
  },
  content_source: null,
};

describe('SocialEssayFeedCard', () => {
  it('renders author info, team name, and reading time', () => {
    render(<SocialEssayFeedCard essay={mockEssay} teamName="Tuuli" />);

    expect(screen.getByText('Lukáš Dvořák')).toBeInTheDocument();
    expect(screen.getByText(/Tuuli/)).toBeInTheDocument();
    expect(screen.getByText('Jak postavit MVP za víkend podle Lean Startup')).toBeInTheDocument();
    expect(screen.getByText('The Lean Startup')).toBeInTheDocument();
  });

  it('renders gamification badge for team leader', () => {
    render(
      <SocialEssayFeedCard
        essay={mockEssay}
        authorStats={{ bookPoints: 16, essayCount: 6, isTeamTopReader: true }}
      />,
    );

    expect(screen.getByText(/Největší čtenář:ka týmu · 16 b./)).toBeInTheDocument();
  });

  it('renders gamification badge for active discussion when no team leader', () => {
    render(
      <SocialEssayFeedCard
        essay={mockEssay}
        authorStats={{ bookPoints: 4, essayCount: 2, isTeamTopReader: false }}
      />,
    );

    expect(screen.getByText('Živá diskuze')).toBeInTheDocument();
  });

  it('renders quote snippet from essay content', () => {
    render(<SocialEssayFeedCard essay={mockEssay} />);

    expect(screen.getByText(/Po přečtení knihy jsme v týmu udělali první experiment/)).toBeInTheDocument();
  });

  it('renders the content source capsule with title, kind and points', () => {
    render(
      <SocialEssayFeedCard
        essay={{
          ...mockEssay,
          book_id: null,
          book: null,
          content_source_id: 'src-1',
          content_source: {
            id: 'src-1',
            kind: 'podcast',
            title: 'Founders',
            creator: 'David Senra',
            points: 0.5,
            status: 'approved',
          },
        }}
      />,
    );

    expect(screen.getByText('Founders')).toBeInTheDocument();
    expect(screen.getByText(/Podcast · David Senra/)).toBeInTheDocument();
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
  });

  it('renders no source capsule when the essay has neither a book nor a content source', () => {
    render(<SocialEssayFeedCard essay={{ ...mockEssay, book_id: null, book: null }} />);

    expect(screen.queryByText('The Lean Startup')).not.toBeInTheDocument();
  });
});
