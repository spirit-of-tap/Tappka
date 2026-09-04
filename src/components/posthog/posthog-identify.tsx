"use client"

import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

export function PostHogIdentify({
  distinctId,
  role,
  betaAccess,
  betaCohort,
  teamId,
}: {
  distinctId: string
  role: string
  betaAccess: boolean
  betaCohort: "A" | "B"
  teamId?: string | null
}) {
  const posthog = usePostHog()
  useEffect(() => {
    if (!posthog) return
    posthog.identify(distinctId, {
      role,
      beta_access: betaAccess,
      beta_cohort: betaCohort,
    })
    if (teamId) posthog.group("team", teamId)
  }, [posthog, distinctId, role, betaAccess, betaCohort, teamId])
  return null
}
