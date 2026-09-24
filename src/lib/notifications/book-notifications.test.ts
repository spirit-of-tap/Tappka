import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./send-email', () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from './send-email';
import {
  selectCoachRecipients,
  notifyBookSubmitted,
  notifyBookDecided,
  type CoachRecipient,
} from './book-notifications';

const mockedSendEmail = vi.mocked(sendEmail);

beforeEach(() => {
  vi.clearAllMocks();
});

const TEAM = 'team-1';

const teamCoach: CoachRecipient = {
  id: 'c1',
  work_email: 'coach1@studenti.czu.cz',
  team_id: TEAM,
  book_submitted_email: true,
};
const otherTeamCoach: CoachRecipient = {
  id: 'c2',
  work_email: 'coach2@studenti.czu.cz',
  team_id: 'team-2',
  book_submitted_email: true,
};
const coachWithoutBeta: CoachRecipient = {
  id: 'c3',
  work_email: 'coach3@studenti.czu.cz',
  team_id: TEAM,
  book_submitted_email: true,
};
const noEmail: CoachRecipient = {
  id: 'c4',
  work_email: null,
  team_id: TEAM,
  book_submitted_email: true,
};
const notificationsOff: CoachRecipient = {
  id: 'c5',
  work_email: 'coach5@studenti.czu.cz',
  team_id: TEAM,
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

  it('includes coaches without beta access', () => {
    expect(selectCoachRecipients([coachWithoutBeta], TEAM).map((c) => c.id)).toEqual(['c3']);
  });

  it('drops coaches without a work email or with notifications off', () => {
    expect(selectCoachRecipients([noEmail, notificationsOff], TEAM)).toEqual([]);
  });

  it('returns nothing when there are no coaches at all', () => {
    expect(selectCoachRecipients([], TEAM)).toEqual([]);
  });
});

describe('notifyBookSubmitted', () => {
  it('sends email to eligible coaches without requiring beta access', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'books') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    title_cs: 'Kniha 1',
                    author: 'Autor',
                    book_points: 3,
                    list_status_reason: 'Důvod',
                  },
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn((fields: string) => {
              if (fields.includes('name')) {
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { name: 'Student', team_id: TEAM },
                    })),
                  })),
                };
              }
              return {
                eq: vi.fn(async () => ({
                  data: [coachWithoutBeta],
                })),
              };
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn(async () => ({
        data: [{ book_submitted_email: true }],
        error: null,
      })),
    };

    await notifyBookSubmitted(supabase as never, {
      bookId: 'b1',
      submitterProfileId: 's1',
      origin: 'https://tappka.cz',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'coach3@studenti.czu.cz' }),
    );
  });
});

describe('notifyBookDecided', () => {
  it('sends email to submitter without requiring beta access', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'books') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    title_cs: 'Kniha 1',
                    book_points: 3,
                    list_status: 'reading_list',
                    list_status_reason: 'Schváleno',
                    created_by_profile_id: 's1',
                  },
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { work_email: 'student@studenti.czu.cz' },
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    await notifyBookDecided(supabase as never, {
      bookId: 'b1',
      origin: 'https://tappka.cz',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'student@studenti.czu.cz' }),
    );
  });
});
