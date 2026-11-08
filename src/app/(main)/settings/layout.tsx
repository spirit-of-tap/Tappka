import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { SettingsFrame } from "@/components/settings/settings-frame"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { visibleSettingsSections } from "@/lib/settings/sections"

const DEFAULT_BETA_COHORT = "A" as const

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const sections = visibleSettingsSections({
    role: profile.role,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: profile.beta_cohort ?? DEFAULT_BETA_COHORT,
    teamId: profile.team_id,
  })

  return (
    <PageShell className="max-w-5xl">
      <SettingsFrame sections={sections}>{children}</SettingsFrame>
    </PageShell>
  )
}
