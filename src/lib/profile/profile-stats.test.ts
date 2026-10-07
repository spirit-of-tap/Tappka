import { describe, expect, it } from 'vitest';

import type { AccessProfile } from '@/lib/feature-access';

import { getVisibleGatedStats } from './profile-stats';

const BETA_B: AccessProfile = { role: 'student', beta_access_granted_at: '2026-01-01', beta_cohort: 'B' };
const COHORT_A: AccessProfile = { role: 'student', beta_access_granted_at: '2026-01-01', beta_cohort: 'A' };
const NOT_ENROLLED: AccessProfile = { role: 'student', beta_access_granted_at: null, beta_cohort: 'B' };
const ADMIN: AccessProfile = { role: 'admin', beta_access_granted_at: null, beta_cohort: 'A' };

const ALL_VISIBLE = { customerMeetings: true, coachingSessions: true, birthGiving: true };
const NONE_VISIBLE = { customerMeetings: false, coachingSessions: false, birthGiving: false };

describe('getVisibleGatedStats', () => {
  it('shows gated stats when viewer and owner both have beta access', () => {
    expect(getVisibleGatedStats(BETA_B, BETA_B)).toEqual(ALL_VISIBLE);
  });

  it('hides gated stats from a viewer without access', () => {
    expect(getVisibleGatedStats(COHORT_A, BETA_B)).toEqual(NONE_VISIBLE);
    expect(getVisibleGatedStats(NOT_ENROLLED, BETA_B)).toEqual(NONE_VISIBLE);
  });

  it('hides gated stats on a profile whose owner cannot use the features', () => {
    expect(getVisibleGatedStats(ADMIN, COHORT_A)).toEqual(NONE_VISIBLE);
  });

  it('hides everything when the viewer is unknown', () => {
    expect(getVisibleGatedStats(null, BETA_B)).toEqual(NONE_VISIBLE);
  });
});
