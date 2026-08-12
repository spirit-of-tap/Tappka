import { describe, expect, it } from 'vitest';

import { selectCoachRecipients, type CoachRecipient } from './book-notifications';

const TEAM = 'team-1';

const teamCoach: CoachRecipient = {
  id: 'c1',
  work_email: 'coach1@studenti.czu.cz',
  team_id: TEAM,
  beta_access_granted_at: '2026-01-01T00:00:00Z',
  book_submitted_email: true,
};
const otherTeamCoach: CoachRecipient = {
  id: 'c2',
  work_email: 'coach2@studenti.czu.cz',
  team_id: 'team-2',
  beta_access_granted_at: '2026-01-01T00:00:00Z',
  book_submitted_email: true,
};
const noBeta: CoachRecipient = {
  id: 'c3',
  work_email: 'coach3@studenti.czu.cz',
  team_id: TEAM,
  beta_access_granted_at: null,
  book_submitted_email: true,
};
const noEmail: CoachRecipient = {
  id: 'c4',
  work_email: null,
  team_id: TEAM,
  beta_access_granted_at: '2026-01-01T00:00:00Z',
  book_submitted_email: true,
};
const notificationsOff: CoachRecipient = {
  id: 'c5',
  work_email: 'coach5@studenti.czu.cz',
  team_id: TEAM,
  beta_access_granted_at: '2026-01-01T00:00:00Z',
  book_submitted_email: false,
};

describe('selectCoachRecipients', () => {
  it("prefers coaches on the submitter's own team", () => {
    const picked = selectCoachRecipients([teamCoach, otherTeamCoach], TEAM);
    expect(picked.map((c) => c.id)).toEqual(['c1']);
  });

  it('falls back to every coach when the team has none', () => {
    const picked = selectCoachRecipients([otherTeamCoach], TEAM);
    expect(picked.map((c) => c.id)).toEqual(['c2']);
  });

  it('falls back to every coach when the submitter has no team', () => {
    const picked = selectCoachRecipients([teamCoach, otherTeamCoach], null);
    expect(picked.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('drops coaches without beta access, without a work email, or with notifications off', () => {
    expect(selectCoachRecipients([noBeta, noEmail, notificationsOff], TEAM)).toEqual([]);
  });

  it('returns nothing when there are no coaches at all', () => {
    expect(selectCoachRecipients([], TEAM)).toEqual([]);
  });
});
