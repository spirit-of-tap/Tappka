import { describe, expect, it } from 'vitest';

import { essayIdsAwaitingReply, type CommentActivity } from './awaiting-reply';

const ME = 'me';
const c = (essay_id: string, author_profile_id: string, created_at: string, author_role: string | null): CommentActivity => ({
  essay_id,
  author_profile_id,
  created_at,
  author_role,
});

describe('essayIdsAwaitingReply', () => {
  it('flags an essay with a coach comment and no reply from the author', () => {
    const result = essayIdsAwaitingReply([c('e1', 'coach-1', '2026-11-01T10:00:00Z', 'coach')], ME);
    expect([...result]).toEqual(['e1']);
  });

  it('clears the flag once the author replies after the coach', () => {
    const result = essayIdsAwaitingReply(
      [
        c('e1', 'coach-1', '2026-11-01T10:00:00Z', 'coach'),
        c('e1', ME, '2026-11-01T12:00:00Z', 'student'),
      ],
      ME,
    );
    expect(result.size).toBe(0);
  });

  it('re-flags the essay when the coach comments again after the reply', () => {
    const result = essayIdsAwaitingReply(
      [
        c('e1', 'coach-1', '2026-11-01T10:00:00Z', 'coach'),
        c('e1', ME, '2026-11-01T12:00:00Z', 'student'),
        c('e1', 'coach-1', '2026-11-02T09:00:00Z', 'coach'),
      ],
      ME,
    );
    expect([...result]).toEqual(['e1']);
  });

  it('ignores comments from other students', () => {
    const result = essayIdsAwaitingReply([c('e1', 'peer', '2026-11-01T10:00:00Z', 'student')], ME);
    expect(result.size).toBe(0);
  });

  it('does not count an earlier author comment as a reply', () => {
    const result = essayIdsAwaitingReply(
      [
        c('e1', ME, '2026-10-30T10:00:00Z', 'student'),
        c('e1', 'coach-1', '2026-11-01T10:00:00Z', 'coach'),
      ],
      ME,
    );
    expect([...result]).toEqual(['e1']);
  });

  it('evaluates each essay independently', () => {
    const result = essayIdsAwaitingReply(
      [
        c('e1', 'coach-1', '2026-11-01T10:00:00Z', 'coach'),
        c('e2', 'coach-1', '2026-11-01T10:00:00Z', 'coach'),
        c('e2', ME, '2026-11-01T11:00:00Z', 'student'),
      ],
      ME,
    );
    expect([...result]).toEqual(['e1']);
  });
});
