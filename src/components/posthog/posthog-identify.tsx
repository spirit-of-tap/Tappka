"use client"

import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

export function PostHogIdentify({
  distinctId,
  betaAccess,
  betaCohort,
}: {
  distinctId: string
  betaAccess: boolean
  betaCohort: "A" | "B"
}) {
  const posthog = usePostHog()
  useEffect(() => {
    if (!posthog) return
    posthog.identify(distinctId, { beta_access: betaAccess, beta_cohort: betaCohort })
  }, [posthog, distinctId, betaAccess, betaCohort])
  return null
}
