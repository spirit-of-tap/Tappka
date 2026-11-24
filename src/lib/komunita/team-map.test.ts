import { describe, expect, it } from 'vitest';
import type { ProfileWithTeam, Team } from './types';
import {
  BUBBLE_MAX_DIAMETER,
  BUBBLE_MIN_DIAMETER,
  MAX_RING_AVATARS,
  STAFF_GROUP_ID,
  UNASSIGNED_GROUP_ID,
  bubbleDiameter,
  buildMapGroups,
  coachLine,
  defaultSelectedGroupId,
  ringCapacity,
  ringLayout,
  searchMap,
} from './team-map';

function team(id: string, name: string, removedAt: string | null = null): Team {
  return {
    id,
    name,
    color: '#336699',
    picture: null,
    group_picture: null,
    website_url: null,
    instagram_url: null,
    linkedin_url: null,
    ico: null,
    onboardingYear: 2025,
    removed_at: removedAt,
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2025-09-01T00:00:00Z',
    created_by_profile_id: null,
    updated_by_profile_id: null,
  };
}

function person(id: string, name: string, t: Team | null, overrides: Partial<ProfileWithTeam> = {}): ProfileWithTeam {
  return {
    id,
    user_id: `u-${id}`,
    name,
    work_email: `${id}@tap.cz`,
    personal_email: null,
    phone_number: null,
    preferred_name: null,
    date_of_birth: null,
    picture: null,
    bio_json: null,
    role: 'student',
    team_id: t?.id ?? null,
    former_team_id: null,
    team_left_at: null,
    team_removed_by_profile_id: null,
    access_removed_at: null,
    access_removed_by_profile_id: null,
    beta_access_granted_at: null,
    beta_cohort: 'A',
    created_at: '2026-01-01T00:00:00Z',
    created_by_profile_id: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by_profile_id: null,
    team: t,
    ...overrides,
  };
}

describe('bubbleDiameter', () => {
  it('clamps to the min and max diameter', () => {
    expect(bubbleDiameter(0)).toBe(BUBBLE_MIN_DIAMETER);
    expect(bubbleDiameter(1)).toBe(BUBBLE_MIN_DIAMETER);
    expect(bubbleDiameter(500)).toBe(BUBBLE_MAX_DIAMETER);
  });

  it('grows on a sqrt scale', () => {
    const mid = bubbleDiameter(8);
    const linearMid = BUBBLE_MIN_DIAMETER + (BUBBLE_MAX_DIAMETER - BUBBLE_MIN_DIAMETER) * (7 / 29);
    expect(mid).toBeGreaterThan(linearMid);
    expect(bubbleDiameter(12)).toBeGreaterThan(mid);
  });
});

describe('ringCapacity / ringLayout', () => {
  it('fits fewer avatars on a small ring and never exceeds the cap', () => {
    expect(ringCapacity(BUBBLE_MIN_DIAMETER)).toBeLessThan(ringCapacity(BUBBLE_MAX_DIAMETER));
    expect(ringCapacity(BUBBLE_MAX_DIAMETER)).toBe(MAX_RING_AVATARS);
  });

  it('shows everyone when they fit', () => {
    expect(ringLayout(3, BUBBLE_MIN_DIAMETER)).toEqual({ shown: 3, overflow: 0 });
  });

  it('reserves one slot for the +N chip on overflow', () => {
    const capacity = ringCapacity(BUBBLE_MAX_DIAMETER);
    expect(ringLayout(40, BUBBLE_MAX_DIAMETER)).toEqual({ shown: capacity - 1, overflow: 40 - (capacity - 1) });
  });
});

describe('buildMapGroups', () => {
  const a = team('a', 'Aurora');
  const b = team('b', 'Beta');
  const c = team('c', 'Cíl');

  it('orders the viewer team first, then by size, then by name', () => {
    const profiles = [
      person('1', 'Ema', a),
      person('2', 'Eva', b),
      person('3', 'Ivo', b),
      person('4', 'Jan', c),
      person('5', 'Jiří', c),
    ];
    expect(buildMapGroups(profiles, 'a').map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(buildMapGroups(profiles, null).map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });

  it('groups teamless staff and other teamless people separately', () => {
    const groups = buildMapGroups([
      person('1', 'Ema', a),
      person('2', 'Kouč', null, { role: 'coach' }),
      person('3', 'Admin', null, { role: 'admin' }),
      person('4', 'Mentor', null, { role: 'mentor' }),
    ]);
    expect(groups.map((g) => g.id)).toEqual(['a', STAFF_GROUP_ID, UNASSIGNED_GROUP_ID]);
    expect(groups[1].members).toHaveLength(2);
    expect(groups[2].members.map((m) => m.name)).toEqual(['Mentor']);
  });

  it('omits the neutral groups when empty and skips alumni and archived teams', () => {
    const old = team('old', 'Starý', '2023-06-30T00:00:00Z');
    const groups = buildMapGroups([
      person('1', 'Ema', a),
      person('2', 'Absolvent', old),
      person('3', 'Odešlý', null, { former_team_id: 'a' }),
    ]);
    expect(groups.map((g) => g.id)).toEqual(['a']);
  });

  it('puts coaches first in a team and builds the coach line', () => {
    const [group] = buildMapGroups([
      person('1', 'Zdeněk', a),
      person('2', 'Karel', a, { role: 'coach' }),
    ]);
    expect(group.members[0].name).toBe('Karel');
    expect(coachLine(group)).toBe('kouč:ka Karel');
  });

  it('handles 60 teams', () => {
    const profiles = Array.from({ length: 60 }, (_, i) =>
      person(`p${i}`, `Člen ${i}`, team(`t${i}`, `Tým ${String(i).padStart(2, '0')}`)),
    );
    const groups = buildMapGroups(profiles, 't42');
    expect(groups).toHaveLength(60);
    expect(groups[0].id).toBe('t42');
    expect(new Set(groups.map((g) => g.id)).size).toBe(60);
  });
});

describe('defaultSelectedGroupId', () => {
  const groups = buildMapGroups([person('1', 'Ema', team('a', 'Aurora')), person('2', 'Eva', team('b', 'Beta'))]);

  it('prefers the viewer team, else the first group', () => {
    expect(defaultSelectedGroupId(groups, 'b')).toBe('b');
    expect(defaultSelectedGroupId(groups, 'zzz')).toBe(groups[0].id);
    expect(defaultSelectedGroupId([], null)).toBeNull();
  });
});

describe('searchMap', () => {
  const a = team('a', 'Aurora');
  const b = team('b', 'Beta');
  const profiles = [
    person('1', 'Ema Černá', a),
    person('2', 'Eva Bílá', b),
    person('3', 'Ivo Novák', b),
  ];
  const groups = buildMapGroups(profiles);

  it('returns everything for an empty query', () => {
    expect(searchMap(profiles, groups, '  ').people).toHaveLength(3);
  });

  it('matches people diacritics-insensitively and highlights their team', () => {
    const result = searchMap(profiles, groups, 'cerna');
    expect(result.people.map((p) => p.id)).toEqual(['1']);
    expect([...result.highlightedGroupIds]).toEqual(['a']);
  });

  it('matches teams by name and includes their roster', () => {
    const result = searchMap(profiles, groups, 'beta');
    expect(result.people.map((p) => p.id)).toEqual(['2', '3']);
    expect([...result.highlightedGroupIds]).toEqual(['b']);
  });

  it('returns nothing when neither people nor teams match', () => {
    const result = searchMap(profiles, groups, 'xyz');
    expect(result.people).toEqual([]);
    expect(result.highlightedGroupIds.size).toBe(0);
  });
});
