export const BETA_FEATURES = {
  customerMeetings: ["B"],
  coaching: ["B"],
  teamReflection: ["B"],
  teamDiary: ["B"],
  teamDocuments: ["B"],
  toolsTechniques: ["B"],
  personalityTests: ["B"],
  birthGiving: ["B"],
  rocketModel: ["B"],
  portfolio: ["B"],
  dashboardMetrics: ["B"],
  trainingSessions: ["B"],
} as const

/**
 * Features that graduated from beta: open to every signed-in profile. Their keys stay so
 * existing gates (`canAccessFeature(profile, "timeTracking")`) keep working unchanged.
 */
export const RELEASED_FEATURES = ["timeTracking", "komunitniKasa"] as const

export type BetaFeature = keyof typeof BETA_FEATURES
export type ReleasedFeature = (typeof RELEASED_FEATURES)[number]
export type Feature = BetaFeature | ReleasedFeature

function isReleasedFeature(feature: Feature): feature is ReleasedFeature {
  return (RELEASED_FEATURES as readonly string[]).includes(feature)
}
export type BetaCohort = "A" | "B"
export type AccessProfile = {
  role: string
  beta_access_granted_at: string | null
  beta_cohort: BetaCohort
  /** Team id for team-scoped features (e.g. rocketModel). Absent = no team. */
  teamId?: string | null
  /** Team name for team-scoped features (e.g. rocketModel). Absent = no team. */
  teamName?: string | null
}

/** Rocket Model is piloted with a single team — everyone else is locked out (admins bypass). */
export const ROCKET_MODEL_ALLOWED_TEAM_NAME = "Tuuli" as const
export const ROCKET_MODEL_ALLOWED_TEAM_ID = "9fb20836-12f7-4e09-8c82-6a4d97bc51b4" as const

export function canAccessFeature(profile: AccessProfile | null | undefined, feature: Feature): boolean {
  if (!profile) return false
  if (isReleasedFeature(feature)) return true
  if (profile.role === "admin") return true
  if (feature === "rocketModel") {
    return (
      profile.teamId === ROCKET_MODEL_ALLOWED_TEAM_ID ||
      profile.teamName === ROCKET_MODEL_ALLOWED_TEAM_NAME
    )
  }
  if (!profile.beta_access_granted_at) return false
  const allowed = BETA_FEATURES[feature]
  return (allowed as readonly string[]).includes(profile.beta_cohort)
}

export function isBetaEnrolled(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false
  return profile.beta_access_granted_at !== null
}
