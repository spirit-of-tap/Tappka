import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { TsTabBar } from "@/components/training-sessions/ts-tab-bar"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

const DEFAULT_BETA_COHORT: BetaCohort = "A"

export default async function TsLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const allowed = canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: profile.beta_cohort ?? DEFAULT_BETA_COHORT,
    },
    "trainingSessions",
  )
  if (!allowed) return <FeatureComingSoon featureName="Tréninkové sessions" />
  return (
    <>
      <TsTabBar />
      {children}
    </>
  )
}
