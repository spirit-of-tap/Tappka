import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { TimeTagSettings } from "@/components/settings/time-tag-settings"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"
import { getTagCatalog } from "@/lib/time-tracking/queries"

const PAGE_TITLE = "Tagy v Čase"
const PAGE_DESCRIPTION = "Vyber, které týmové tagy se ti nabízejí při zapisování času"

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
}

export default async function TimeTagSettingsPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: profile.beta_cohort ?? "A",
      },
      "timeTracking",
    )
  ) {
    return <FeatureComingSoon featureName="Čas" />
  }

  const catalog = await getTagCatalog(supabase, profile)

  return (
    <PageShell size="narrow">
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <TimeTagSettings
        tags={catalog.tags}
        selectedTagIds={catalog.selectedTagIds}
        reviewedAt={catalog.reviewedAt}
        newTagCount={catalog.newTagCount}
        profileId={profile.id}
        hasTeam={profile.team_id !== null}
      />
    </PageShell>
  )
}
