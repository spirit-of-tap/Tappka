import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/essays/queries', () => ({
  getEssayAuthorInfo: vi.fn(),
}));
vi.mock('@/lib/komunita/queries', () => ({
  getProfileById: vi.fn(),
}));
vi.mock('./send-email', () => ({
  sendEmail: vi.fn(),
}));

import { getEssayAuthorInfo } from '@/lib/essays/queries';
import { getProfileById } from '@/lib/komunita/queries';
import { sendEmail } from './send-email';
import { notifyEssayCommented, notifyEssayVoted, notifyEssayCoachRead } from './essay-notifications';

const mockedGetEssayAuthorInfo = vi.mocked(getEssayAuthorInfo);
const mockedGetProfileById = vi.mocked(getProfileById);
const mockedSendEmail = vi.mocked(sendEmail);

function supabaseStub(preferencesRow: Record<string, boolean> | null) {
  const rpc = vi.fn(async () => ({
    data: [
      {
        essay_coach_read_email: true,
        essay_comment_email: true,
        essay_vote_email: true,
        ...preferencesRow,
      },
    ],
    error: null,
  }));

  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const ESSAY = { id: 'essay-1', title: 'Moje esej', authorProfileId: 'author-1' };
const AUTHOR = {
  id: 'author-1',
  name: 'Anna Autorová',
  work_email: 'anna@studenti.czu.cz',
  beta_access_granted_at: '2026-01-01T00:00:00.000Z',
};
const ACTOR = {
  id: 'actor-1',
  name: 'Petr Herec',
  work_email: 'petr@studenti.czu.cz',
  beta_access_granted_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetEssayAuthorInfo.mockResolvedValue(ESSAY);
  mockedGetProfileById.mockImplementation(async (_supabase, id) =>
    (id === AUTHOR.id ? AUTHOR : ACTOR) as never,
  );
});

describe('notifyEssayCommented', () => {
  it('skips when the actor is the essay author', async () => {
    mockedGetEssayAuthorInfo.mockResolvedValue({ ...ESSAY, authorProfileId: ACTOR.id });

    await notifyEssayCommented(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('skips when the preference is explicitly off', async () => {
    await notifyEssayCommented(supabaseStub({ essay_comment_email: false }).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('sends when no preference row exists (default on)', async () => {
    await notifyEssayCommented(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: AUTHOR.work_email }),
    );
  });

  it('sends to the essay author with a link back to the essay', async () => {
    const { client, rpc } = supabaseStub({ essay_comment_email: true });

    await notifyEssayCommented(client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe(AUTHOR.work_email);
    expect(call.html).toContain('https://tappka.app/eseje/essay-1');
    expect(rpc).toHaveBeenCalledWith('get_notification_preferences', {
      p_profile_id: ESSAY.authorProfileId,
    });
  });

  it('skips when the author has no beta access', async () => {
    mockedGetProfileById.mockImplementation(async (_supabase, id) =>
      (id === AUTHOR.id ? { ...AUTHOR, beta_access_granted_at: null } : ACTOR) as never,
    );

    await notifyEssayCommented(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyEssayVoted', () => {
  it('skips when the actor is the essay author', async () => {
    mockedGetEssayAuthorInfo.mockResolvedValue({ ...ESSAY, authorProfileId: ACTOR.id });

    await notifyEssayVoted(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('skips when the preference is explicitly off', async () => {
    await notifyEssayVoted(supabaseStub({ essay_vote_email: false }).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('sends when no preference row exists (default on)', async () => {
    await notifyEssayVoted(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: AUTHOR.work_email }),
    );
  });

  it('sends to the essay author with a link back to the essay', async () => {
    const { client, rpc } = supabaseStub({ essay_vote_email: true });

    await notifyEssayVoted(client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe(AUTHOR.work_email);
    expect(call.html).toContain('https://tappka.app/eseje/essay-1');
    expect(rpc).toHaveBeenCalledWith('get_notification_preferences', {
      p_profile_id: ESSAY.authorProfileId,
    });
  });

  it('skips when the author has no beta access', async () => {
    mockedGetProfileById.mockImplementation(async (_supabase, id) =>
      (id === AUTHOR.id ? { ...AUTHOR, beta_access_granted_at: null } : ACTOR) as never,
    );

    await notifyEssayVoted(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyEssayCoachRead', () => {
  it('skips when the actor is the essay author', async () => {
    mockedGetEssayAuthorInfo.mockResolvedValue({ ...ESSAY, authorProfileId: ACTOR.id });

    await notifyEssayCoachRead(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('skips when the preference is explicitly off', async () => {
    await notifyEssayCoachRead(supabaseStub({ essay_coach_read_email: false }).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('sends when no preference row exists (default on)', async () => {
    await notifyEssayCoachRead(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: AUTHOR.work_email }),
    );
  });

  it('sends to the essay author with a link back to the essay', async () => {
    const { client, rpc } = supabaseStub({ essay_coach_read_email: true });

    await notifyEssayCoachRead(client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe(AUTHOR.work_email);
    expect(call.html).toContain('https://tappka.app/eseje/essay-1');
    expect(rpc).toHaveBeenCalledWith('get_notification_preferences', {
      p_profile_id: ESSAY.authorProfileId,
    });
  });

  it('skips when the author has no beta access', async () => {
    mockedGetProfileById.mockImplementation(async (_supabase, id) =>
      (id === AUTHOR.id ? { ...AUTHOR, beta_access_granted_at: null } : ACTOR) as never,
    );

    await notifyEssayCoachRead(supabaseStub(null).client, {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
