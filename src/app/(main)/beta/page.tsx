import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { BetaPageContent } from "@/components/beta/beta-page-content"
import { BetaAdminPanel, type BetaParticipant } from "@/components/beta/beta-admin-panel"
import { createAdminClient } from "@/lib/supabase/admin"

export default async function BetaPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  if (!user) redirect("/auth/login")

  const profile = await getCurrentUserProfile(supabase, { user })
  if (!profile) redirect("/auth/login")
  const betaAccess = profile.beta_access_granted_at != null

  let participants: BetaParticipant[] = []
  if (profile.role === "admin") {
    try {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (admin as any)
        .from("profiles")
        .select("id, name, work_email, beta_cohort, beta_access_granted_at, team_id")
        .not("beta_access_granted_at", "is", null)
        .is("access_removed_at", null)
        .order("name", { ascending: true })
      if (data) {
        participants = (data as Array<Record<string, unknown>>).map((r) => ({
          id: r.id as string,
          name: (r.name as string | null) ?? null,
          work_email: r.work_email as string,
          beta_cohort: ((r as { beta_cohort?: string }).beta_cohort as "A" | "B") ?? "A",
          team_id: (r.team_id as string | null) ?? null,
        }))
      }
    } catch {
      participants = []
    }
  }

  return (
    <div className="space-y-6">
      <BetaPageContent initialBetaAccess={betaAccess} />
      {profile.role === "admin" && <BetaAdminPanel participants={participants} />}
    </div>
  )
}
