import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getTeamReflectionForMonth } from "@/lib/tymova-reflexe/queries"
import { TeamReflectionCreate } from "@/components/tymova-reflexe/team-reflection-create"
import { PageHeader } from "@/components/ui/page-header"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

export const metadata = {
  title: "Nová reflexe",
}

export default async function NovaReflexePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = monthParam && MONTH_PATTERN.test(monthParam) ? monthParam : getCurrentMonth()

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "teamReflection",
    )
  ) {
    return <FeatureComingSoon featureName="Týmová reflexe" />
  }
  if (!profile.team_id) redirect("/")

  const existing = await getTeamReflectionForMonth(supabase, profile.team_id, month)
  if (existing) redirect(`/tymova-reflexe/${existing.id}`)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <PageHeader
        title="Nová týmová reflexe"
        description={`Vytvoří prázdnou reflexi za ${monthLabel(month)} — změny se ukládají automaticky`}
        back={{ href: "/tymova-reflexe", label: "Zpět na přehled" }}
      />
      <TeamReflectionCreate
        teamId={profile.team_id}
        profileId={profile.id}
        month={month}
        label={monthLabel(month)}
      />
    </div>
  )
}
