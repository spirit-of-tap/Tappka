import { canAccessFeature, type AccessProfile, type BetaFeature } from '@/lib/feature-access';

/** Profile stats backed by a beta feature — hidden unless both sides can use it. */
export const GATED_PROFILE_STATS = {
  customerMeetings: 'customerMeetings',
  coachingSessions: 'coaching',
  birthGiving: 'birthGiving',
} as const satisfies Record<string, BetaFeature>;

export type GatedProfileStat = keyof typeof GATED_PROFILE_STATS;

/**
 * A feature-backed stat (and its tab) only makes sense on a profile when the
 * viewer can open that feature and the profile owner can use it — otherwise
 * it is either a dead end for the viewer or a permanent, meaningless zero.
 */
export function getVisibleGatedStats(
  viewer: AccessProfile | null | undefined,
  owner: AccessProfile | null | undefined,
): Record<GatedProfileStat, boolean> {
  const visible = (feature: BetaFeature) =>
    canAccessFeature(viewer, feature) && canAccessFeature(owner, feature);
  return {
    customerMeetings: visible(GATED_PROFILE_STATS.customerMeetings),
    coachingSessions: visible(GATED_PROFILE_STATS.coachingSessions),
    birthGiving: visible(GATED_PROFILE_STATS.birthGiving),
  };
}
