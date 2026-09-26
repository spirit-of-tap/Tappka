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

function bookSubmittedSupabaseStub(coaches: CoachRecipient[]) {
  return {
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
                data: coaches,
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
}

const SUBMIT_PARAMS = {
  bookId: 'b1',
  submitterProfileId: 's1',
  origin: 'https://tappka.cz',
};

describe('notifyBookSubmitted', () => {
  it('sends email to eligible coaches without requiring beta access', async () => {
    await notifyBookSubmitted(bookSubmittedSupabaseStub([coachWithoutBeta]) as never, SUBMIT_PARAMS);

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'coach3@studenti.czu.cz' }),
    );
  });

  it('sends to coaches one at a time so a large team does not trip the Resend rate limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockedSendEmail.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;
      return { id: 'ok' };
    });

    await notifyBookSubmitted(bookSubmittedSupabaseStub([teamCoach, coachWithoutBeta]) as never, SUBMIT_PARAMS);

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
  });

  it('still emails the remaining coaches when one send fails, then reports the failure', async () => {
    mockedSendEmail
      .mockRejectedValueOnce(new Error('Resend send failed: boom'))
      .mockResolvedValueOnce({ id: 'ok' });

    await expect(
      notifyBookSubmitted(bookSubmittedSupabaseStub([teamCoach, coachWithoutBeta]) as never, SUBMIT_PARAMS),
    ).rejects.toThrow('1 of 2');

    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendEmail).toHaveBeenLastCalledWith(
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
