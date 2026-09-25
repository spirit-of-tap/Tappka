import { describe, expect, it } from 'vitest';

import { COACH_REVIEW_MAX_PAGE_SIZE, parseCoachReviewParams, teamIdForQuery } from './coach-review-params';

function parse(params: Record<string, string>, defaultTeam = 'team-1') {
  return parseCoachReviewParams((key) => params[key], defaultTeam);
}

describe('parseCoachReviewParams', () => {
  it('falls back to defaults for missing params', () => {
    expect(parse({})).toEqual({
      tab: 'unread',
      team: 'team-1',
      rocket: 'all',
      points: 'all',
      reply: 'all',
      search: '',
      page: 1,
      pageSize: 50,
      hasExplicitFilters: false,
    });
  });

  it('rejects unknown enum values', () => {
    const p = parse({ tab: 'x', rocket: 'x', points: '7', reply: 'x' });
    expect([p.tab, p.rocket, p.points, p.reply]).toEqual(['unread', 'all', 'all', 'all']);
  });

  it('keeps valid values and flags explicit filters', () => {
    const p = parse({ tab: 'read', team_id: 'all', points: '2', q: '  Nováková  ' });
    expect(p.tab).toBe('read');
    expect(p.team).toBe('all');
    expect(p.points).toBe('2');
    expect(p.search).toBe('Nováková');
    expect(p.hasExplicitFilters).toBe(true);
  });

  it('does not treat tab or paging as explicit filters', () => {
    expect(parse({ tab: 'read', page: '2' }).hasExplicitFilters).toBe(false);
  });

  it('clamps page size and ignores invalid paging', () => {
    expect(parse({ page_size: '100000' }).pageSize).toBe(COACH_REVIEW_MAX_PAGE_SIZE);
    expect(parse({ page: '-3', page_size: 'abc' })).toMatchObject({ page: 1, pageSize: 50 });
  });
});

describe('teamIdForQuery', () => {
  it('maps "all" to null', () => {
    expect(teamIdForQuery('all')).toBeNull();
    expect(teamIdForQuery('team-1')).toBe('team-1');
  });
});
