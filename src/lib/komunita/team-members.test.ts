import { describe, expect, it } from 'vitest';

import { countTeamMembers } from './team-members';

describe('countTeamMembers', () => {
  it('excludes coaches from the member count', () => {
    expect(
      countTeamMembers([{ role: 'coach' }, { role: 'student' }, { role: 'mentor' }, { role: 'student' }]),
    ).toBe(3);
  });

  it('returns 0 for a team with only coaches', () => {
    expect(countTeamMembers([{ role: 'coach' }])).toBe(0);
  });
});
