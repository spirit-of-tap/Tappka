import { describe, expect, it } from 'vitest';
import {
  MAX_LABELED_MILESTONES,
  buildPathMilestones,
  buildReadingPath,
  daysLeftInSemester,
  daysLeftLabel,
  labelAlign,
  pathPosition,
  pickLabeledMilestones,
  readingSummary,
} from './reading-path';
import type { EssayWithDetails } from './types';

function essay(overrides: Partial<EssayWithDetails> & { bookId?: string; points?: number; status?: string } = {}): EssayWithDetails {
  const { bookId = 'b1', points = 2, status = 'longlist', ...rest } = overrides;
  return {
    id: `e-${bookId}`,
    author_profile_id: 'p',
    book_id: bookId,
    frozen_book_points: null,
    content_source_id: null,
    title: 'Esej',
    content_json: {},
    content_text: '',
    published_at: '2026-10-01T10:00:00Z',
    view_count: 0,
    vote_count: 0,
    comment_count: 0,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    author: null,
    book: {
      id: bookId,
      title_cs: `Kniha ${bookId}`,
      author: 'A',
      book_points: points,
      list_status: status,
      is_rocket_model: false,
      google_books_cover_url: null,
      highlight_category: null,
    } as EssayWithDetails['book'],
    content_source: null,
    ...rest,
  };
}

describe('buildPathMilestones', () => {
  it('orders credited essays by publication and accumulates points', () => {
    const milestones = buildPathMilestones(
      [
        essay({ bookId: 'b2', points: 3, published_at: '2026-10-05T10:00:00Z' }),
        essay({ bookId: 'b1', points: 2, published_at: '2026-10-01T10:00:00Z' }),
      ],
      20,
    );
    expect(milestones.map((m) => [m.title, m.cumulative, m.position])).toEqual([
      ['Kniha b1', 2, 10],
      ['Kniha b2', 5, 25],
    ]);
  });

  it('skips pending, archived, unpublished and zero-point essays', () => {
    const milestones = buildPathMilestones(
      [
        essay({ bookId: 'a', status: 'processing' }),
        essay({ bookId: 'b', status: 'archived', points: 0 }),
        essay({ bookId: 'c', published_at: null }),
        essay({ bookId: 'd', points: 0 }),
      ],
      20,
    );
    expect(milestones).toEqual([]);
  });

  it('credits one book once, to the earliest essay', () => {
    const first = essay({ bookId: 'b1', published_at: '2026-10-01T10:00:00Z' });
    const second = { ...essay({ bookId: 'b1', published_at: '2026-11-01T10:00:00Z' }), id: 'later' };
    const milestones = buildPathMilestones([second, first], 20);
    expect(milestones.map((m) => m.id)).toEqual(['e-b1']);
  });

  it('counts frozen legacy essays per essay', () => {
    const a = { ...essay({ bookId: 'b1' }), id: 'f1', frozen_book_points: '1' };
    const b = { ...essay({ bookId: 'b1', published_at: '2026-10-02T10:00:00Z' }), id: 'f2', frozen_book_points: '1' };
    expect(buildPathMilestones([a, b], 20).map((m) => m.cumulative)).toEqual([1, 2]);
  });

  it('caps the position at the end of the track', () => {
    expect(buildPathMilestones([essay({ points: 3 })], 2)[0].position).toBe(100);
  });
});

describe('pickLabeledMilestones', () => {
  it('labels every milestone that has room', () => {
    expect([...pickLabeledMilestones([10, 40, 80])].sort()).toEqual([0, 1, 2]);
  });

  it('drops labels that collide, preferring the latest', () => {
    expect([...pickLabeledMilestones([50, 55, 60, 90])].sort()).toEqual([2, 3]);
  });

  it('caps the number of labels', () => {
    const positions = [5, 20, 35, 50, 65, 80, 95];
    expect(pickLabeledMilestones(positions).size).toBe(MAX_LABELED_MILESTONES);
    expect(pickLabeledMilestones(positions).has(6)).toBe(true);
  });
});

describe('labelAlign', () => {
  it('anchors labels near the edges inward', () => {
    expect(labelAlign(3)).toBe('start');
    expect(labelAlign(50)).toBe('center');
    expect(labelAlign(97)).toBe('end');
  });
});

describe('buildReadingPath', () => {
  it('has an empty track and no pending marker without essays', () => {
    expect(buildReadingPath(0, 0, 20)).toEqual({ fillPercent: 0, goalReached: false, pending: null });
  });

  it('places the pending marker after the approved points', () => {
    const path = buildReadingPath(7, 2, 20);
    expect(path.fillPercent).toBe(35);
    expect(path.pending).toEqual({ count: 2, position: 45, showLabel: true });
  });

  it('hides the pending label when it would sit on the goal label', () => {
    expect(buildReadingPath(18, 1, 20).pending?.showLabel).toBe(false);
  });

  it('fills the track and drops the pending marker once the goal is reached', () => {
    expect(buildReadingPath(24, 2, 20)).toEqual({ fillPercent: 100, goalReached: true, pending: null });
  });

  it('survives a zero goal', () => {
    expect(pathPosition(5, 0)).toBe(0);
    expect(buildReadingPath(5, 0, 0).goalReached).toBe(false);
  });
});

describe('daysLeftInSemester', () => {
  it('counts to the end of January in the winter semester', () => {
    expect(daysLeftInSemester(new Date('2026-11-24T12:00:00'))).toBe(68);
    expect(daysLeftInSemester(new Date('2027-01-31T08:00:00'))).toBe(0);
  });

  it('counts to the end of August in the summer semester', () => {
    expect(daysLeftInSemester(new Date('2027-02-01T12:00:00'))).toBe(211);
  });
});

describe('daysLeftLabel', () => {
  it('inflects the verb and the noun', () => {
    expect(daysLeftLabel(1)).toBe('zbývá 1 den');
    expect(daysLeftLabel(3)).toBe('zbývají 3 dny');
    expect(daysLeftLabel(68)).toBe('zbývá 68 dní');
    expect(daysLeftLabel(0)).toBe('poslední den semestru');
  });
});

describe('readingSummary', () => {
  it('handles no essays', () => {
    expect(readingSummary({ essay_count: 0, pending_points: 0 })).toBe('Zatím žádné eseje');
  });

  it('mentions books waiting for approval', () => {
    expect(readingSummary({ essay_count: 8, pending_points: 1 })).toBe('8 esejí · 1 kniha čeká na schválení');
    expect(readingSummary({ essay_count: 8, pending_points: 2 })).toBe('8 esejí · 2 knihy čekají na schválení');
  });
});
