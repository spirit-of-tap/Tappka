import { describe, expect, it } from 'vitest';

import {
  REVISION_COALESCE_WINDOW_MINUTES,
  shouldCoalesceRevision,
} from './revisions';

const PROFILE = 'profile-1';
const NOW = '2026-08-10T12:00:00.000Z';

function minutesBefore(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

function candidate(overrides: Partial<{ revision_no: number; created_at: string; created_by_profile_id: string }> = {}) {
  return {
    revision_no: 3,
    created_at: minutesBefore(NOW, 5),
    created_by_profile_id: PROFILE,
    ...overrides,
  };
}

describe('shouldCoalesceRevision', () => {
  it('does not coalesce when there is no prior revision', () => {
    expect(shouldCoalesceRevision(null, PROFILE, NOW)).toBe(false);
  });

  it('coalesces a fresh revision by the same author', () => {
    expect(shouldCoalesceRevision(candidate(), PROFILE, NOW)).toBe(true);
  });

  it('does not coalesce a revision by a different author', () => {
    const other = candidate({ created_by_profile_id: 'profile-2' });
    expect(shouldCoalesceRevision(other, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce once the revision is exactly at the window edge', () => {
    const edge = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES) });
    expect(shouldCoalesceRevision(edge, PROFILE, NOW)).toBe(false);
  });

  it('coalesces just inside the window', () => {
    const inside = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES - 1) });
    expect(shouldCoalesceRevision(inside, PROFILE, NOW)).toBe(true);
  });

  it('does not coalesce past the window', () => {
    const stale = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES + 15) });
    expect(shouldCoalesceRevision(stale, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce a revision timestamped in the future (clock skew)', () => {
    const future = candidate({ created_at: minutesBefore(NOW, -5) });
    expect(shouldCoalesceRevision(future, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce an unparseable timestamp', () => {
    const broken = candidate({ created_at: 'not-a-date' });
    expect(shouldCoalesceRevision(broken, PROFILE, NOW)).toBe(false);
  });
});