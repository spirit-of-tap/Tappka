import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoachReviewList } from './coach-review-list';
import type { CoachReviewEssay } from '@/lib/essays/types';

vi.mock('./coach-read-button', () => ({
  CoachReadButton: ({ onToggled }: { onToggled?: () => void }) => (
    <button onClick={onToggled}>Označit jako přečtené</button>
  ),
}));

function mockEssay(overrides: Partial<CoachReviewEssay> = {}): CoachReviewEssay {
  return {
    id: 'essay-1',
    author_profile_id: 'user-1',
    book_id: 'book-1',
    content_source_id: null,
    title: 'Reflexe a aplikace v týmu',
    content_json: {},
    content_text: 'Tento text shrnuje klíčové myšlenky z knihy...',
    published_at: '2026-08-23T10:00:00Z',
    view_count: 0,
    vote_count: 0,
    comment_count: 0,
    created_at: '2026-08-23T10:00:00Z',
    updated_at: '2026-08-23T10:00:00Z',
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    read_at: null,
    author: {
      id: 'user-1',
      name: 'Matěj Vrbas',
      picture: null,
      role: 'student',
      team_id: 'team-1',
    },
    book: {
      id: 'book-1',
      title_cs: 'The Lean Startup',
      author: 'Eric Ries',
      book_points: 3,
      list_status: 'shortlist',
      is_rocket_model: true,
      google_books_cover_url: 'covers/lean-startup.jpg',
      highlight_category: null,
    },
    content_source: null,
    ...overrides,
  };
}

describe('CoachReviewList', () => {
  const teams = [
    { id: 'team-1', name: 'Alpha' },
    { id: 'team-2', name: 'Beta' },
  ];

  it('renders author book points and book info but omits content text snippet', () => {
    const essay = mockEssay();
    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
        authorPointsMap={{ 'user-1': 24 }}
      />,
    );

    expect(screen.getByText('Matěj Vrbas')).toBeInTheDocument();
    expect(screen.getByText('3 body')).toBeInTheDocument();
    expect(screen.getByText('Reflexe a aplikace v týmu')).toBeInTheDocument();
    expect(screen.getByText('The Lean Startup')).toBeInTheDocument();
    expect(screen.queryByText('Tento text shrnuje klíčové myšlenky z knihy...')).not.toBeInTheDocument();
  });

  it('filters essays by team correctly', () => {
    const essay1 = mockEssay({ id: 'e1', title: 'Esej Alpha', author: { id: 'u1', name: 'Student 1', picture: null, role: 'student', team_id: 'team-1' } });
    const essay2 = mockEssay({ id: 'e2', title: 'Esej Beta', author: { id: 'u2', name: 'Student 2', picture: null, role: 'student', team_id: 'team-2' } });

    const { unmount } = render(
      <CoachReviewList
        initialUnread={[essay1, essay2]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="team-1"
      />,
    );

    expect(screen.getByText('Esej Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Esej Beta')).not.toBeInTheDocument();

    unmount();

    render(
      <CoachReviewList
        initialUnread={[essay1, essay2]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
      />,
    );

    expect(screen.getByText('Esej Alpha')).toBeInTheDocument();
    expect(screen.getByText('Esej Beta')).toBeInTheDocument();
  });

  it('moves essay to read tab when toggled', () => {
    const essay = mockEssay();
    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
      />,
    );

    expect(screen.getByText('Nepřečtené')).toBeInTheDocument();
    const markButton = screen.getByText('Označit jako přečtené');
    fireEvent.click(markButton);

    expect(screen.getByText('Žádné nové eseje ke kontrole')).toBeInTheDocument();
  });

  it('renders coach comment quotes and threaded student replies on essays', () => {
    const essay = mockEssay();
    const coachComment = {
      id: 'comment-1',
      essay_id: 'essay-1',
      author_profile_id: 'coach-1',
      parent_id: null,
      body: 'Skvělé zhodnocení MVP a lean přístupu!',
      removed_at: null,
      created_at: '2026-08-23T11:00:00Z',
      updated_at: '2026-08-23T11:00:00Z',
      author: {
        id: 'coach-1',
        name: 'Kouč Petr',
        picture: null,
        role: 'coach' as const,
      },
    };

    const studentReply = {
      id: 'comment-2',
      essay_id: 'essay-1',
      author_profile_id: 'user-1',
      parent_id: 'comment-1',
      body: 'Díky, v další revizi doplním ještě metriky z testování.',
      removed_at: null,
      created_at: '2026-08-23T12:00:00Z',
      updated_at: '2026-08-23T12:00:00Z',
      author: {
        id: 'user-1',
        name: 'Matěj Vrbas',
        picture: null,
        role: 'student' as const,
      },
    };

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
        commentsMap={{ 'essay-1': [coachComment, studentReply] }}
      />,
    );

    // Coach comments quote is visible
    expect(screen.getByText(/Komentáře \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText('Kouč Petr')).toBeInTheDocument();
    expect(screen.getByText('„Skvělé zhodnocení MVP a lean přístupu!“')).toBeInTheDocument();

    // Student reply quote is visible
    expect(screen.getByText('„Díky, v další revizi doplním ještě metriky z testování.“')).toBeInTheDocument();
  });

  it('renders "Zatím bez odpovědi Téčka" indicator when coach commented but student has not replied', () => {
    const essay = mockEssay();
    const coachComment = {
      id: 'comment-1',
      essay_id: 'essay-1',
      author_profile_id: 'coach-1',
      parent_id: null,
      body: 'Skvělé zhodnocení MVP a lean přístupu!',
      removed_at: null,
      created_at: '2026-08-23T11:00:00Z',
      updated_at: '2026-08-23T11:00:00Z',
      author: {
        id: 'coach-1',
        name: 'Kouč Petr',
        picture: null,
        role: 'coach' as const,
      },
    };

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
        commentsMap={{ 'essay-1': [coachComment] }}
      />,
    );

    // Indicator under coach comment
    expect(screen.getByText('Zatím bez odpovědi Téčka')).toBeInTheDocument();
  });

  it('recognizes author comment posted after coach comment as a reply even when parent_id is null', () => {
    const essay = mockEssay();
    const coachComment = {
      id: 'comment-1',
      essay_id: 'essay-1',
      author_profile_id: 'coach-1',
      parent_id: null,
      body: 'Doporučuji promyslet plán B.',
      removed_at: null,
      created_at: '2026-08-23T10:00:00Z',
      updated_at: '2026-08-23T10:00:00Z',
      author: {
        id: 'coach-1',
        name: 'Kouč Petr',
        picture: null,
        role: 'coach' as const,
      },
    };

    const standaloneAuthorComment = {
      id: 'comment-2',
      essay_id: 'essay-1',
      author_profile_id: 'user-1',
      parent_id: null, // No parent_id!
      body: 'Plán B máme sepsaný v Notion.',
      removed_at: null,
      created_at: '2026-08-23T12:00:00Z', // Posted after coach comment
      updated_at: '2026-08-23T12:00:00Z',
      author: {
        id: 'user-1',
        name: 'Matěj Vrbas',
        picture: null,
        role: 'student' as const,
      },
    };

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
        commentsMap={{ 'essay-1': [coachComment, standaloneAuthorComment] }}
      />,
    );

    expect(screen.getByText('„Plán B máme sepsaný v Notion.“')).toBeInTheDocument();
  });

  it('renders "Upraveno po komentáři" badge when essay was updated after coach comment', () => {
    const essay = mockEssay({
      updated_at: '2026-08-23T16:00:00Z', // 5 hours after coach comment
    });
    const coachComment = {
      id: 'comment-1',
      essay_id: 'essay-1',
      author_profile_id: 'coach-1',
      parent_id: null,
      body: 'Doporučuji rozvést kapitolu o MVP.',
      removed_at: null,
      created_at: '2026-08-23T11:00:00Z',
      updated_at: '2026-08-23T11:00:00Z',
      author: {
        id: 'coach-1',
        name: 'Kouč Petr',
        picture: null,
        role: 'coach' as const,
      },
    };

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
        commentsMap={{ 'essay-1': [coachComment] }}
      />,
    );

    expect(screen.getByText('Upraveno po komentáři')).toBeInTheDocument();
  });

  it('displays exact total unread and read counts on tab badges when thousands exist in database', () => {
    const essay = mockEssay();
    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        initialUnreadCount={4000}
        initialReadCount={125}
        teams={teams}
        defaultTeamId="all"
      />,
    );

    // Unread count badge displays 4000
    expect(screen.getByText('4000')).toBeInTheDocument();
    // Read count badge displays 125
    expect(screen.getByText('125')).toBeInTheDocument();
  });

  it('renders a content source essay with its source title and points', () => {
    const essay = mockEssay({
      book_id: null,
      book: null,
      content_source_id: 'src-1',
      content_source: {
        id: 'src-1',
        kind: 'podcast',
        title: 'Founders',
        creator: 'David Senra',
        points: 2,
        status: 'approved',
      },
    });

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
      />,
    );

    expect(screen.getByText('Founders')).toBeInTheDocument();
    expect(screen.getByText('2 body')).toBeInTheDocument();
    expect(screen.queryByText('Nad rámec četby')).not.toBeInTheDocument();
  });

  it('still marks a sourceless essay as "Nad rámec četby"', () => {
    const essay = mockEssay({ book_id: null, book: null });

    render(
      <CoachReviewList
        initialUnread={[essay]}
        initialRead={[]}
        teams={teams}
        defaultTeamId="all"
      />,
    );

    expect(screen.getByText('Nad rámec četby')).toBeInTheDocument();
  });
});
