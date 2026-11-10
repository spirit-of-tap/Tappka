import { describe, expect, it } from 'vitest';

import { isAlumnus, type AlumniCheckProfile } from './alumni';

const profile = (overrides: Partial<AlumniCheckProfile> = {}): AlumniCheckProfile => ({
  role: 'student',
  team_id: 'team-1',
  former_team_id: null,
  team: { removed_at: null },
  ...overrides,
});

describe('isAlumnus', () => {
  it('keeps a student in an active team in the main list', () => {
    expect(isAlumnus(profile())).toBe(false);
  });

  it('counts a student whose team was archived', () => {
    expect(isAlumnus(profile({ team: { removed_at: '2023-06-30T00:00:00Z' } }))).toBe(true);
  });

  it('counts a student who left their team', () => {
    expect(
      isAlumnus(profile({ team_id: null, former_team_id: 'team-1', team: null })),
    ).toBe(true);
  });

  it('keeps a student still waiting for a first team', () => {
    expect(isAlumnus(profile({ team_id: null, former_team_id: null, team: null }))).toBe(false);
  });

  it('never counts staff, even with a removed team', () => {
    const removedTeam = { removed_at: '2023-06-30T00:00:00Z' };
    expect(isAlumnus(profile({ role: 'coach', team: removedTeam }))).toBe(false);
    expect(isAlumnus(profile({ role: 'mentor', team: removedTeam }))).toBe(false);
    expect(isAlumnus(profile({ role: 'admin', team_id: null, team: null }))).toBe(false);
  });
});
