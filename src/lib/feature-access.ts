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
} as const

export type BetaFeature = keyof typeof BETA_FEATURES
export type BetaCohort = "A" | "B"
export type AccessProfile = {
  role: string
  beta_access_granted_at: string | null
  beta_cohort: BetaCohort
  /** Team name for team-scoped features (e.g. rocketModel). Absent = no team. */
  teamName?: string | null
}

/** Rocket Model is piloted with a single team — everyone else is locked out (admins bypass). */
export const ROCKET_MODEL_ALLOWED_TEAM_NAME = "Tuuli" as const

export function canAccessFeature(profile: AccessProfile | null | undefined, feature: BetaFeature): boolean {
  if (!profile) return false
  if (profile.role === "admin") return true
  if (!profile.beta_access_granted_at) return false
  if (feature === "rocketModel") return profile.teamName === ROCKET_MODEL_ALLOWED_TEAM_NAME
  const allowed = BETA_FEATURES[feature]
  return (allowed as readonly string[]).includes(profile.beta_cohort)
}

export function isBetaEnrolled(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false
  return profile.beta_access_granted_at !== null
}
