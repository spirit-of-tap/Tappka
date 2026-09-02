export const BETA_FEATURES = {
  customerMeetings: ["B"],
  coaching: ["B"],
  teamReflection: ["B"],
  teamDiary: ["B"],
  teamDocuments: ["B"],
  toolsTechniques: ["B"],
  personalityTests: ["B"],
  birthGiving: ["B"],
  portfolio: ["B"],
  dashboardMetrics: ["B"],
} as const

export type BetaFeature = keyof typeof BETA_FEATURES
export type BetaCohort = "A" | "B"
export type AccessProfile = { role: string; beta_access_granted_at: string | null; beta_cohort: BetaCohort }

export function canAccessFeature(profile: AccessProfile | null | undefined, feature: BetaFeature): boolean {
  if (!profile) return false
  if (profile.role === "admin") return true
  if (!profile.beta_access_granted_at) return false
  const allowed = BETA_FEATURES[feature]
  return (allowed as readonly string[]).includes(profile.beta_cohort)
}

export function isBetaEnrolled(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false
  return profile.beta_access_granted_at !== null
}
