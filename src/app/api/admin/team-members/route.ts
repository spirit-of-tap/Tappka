import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { serverLogger } from "@/lib/server-logger"

const schema = z.object({
  profileId: z.string().uuid(),
  action: z.enum(["remove", "restore"]),
})

/**
 * Admin-only team membership management.
 *
 * - remove: clears `team_id`, stores `former_team_id` + `team_left_at` +
 *   `team_removed_by_profile_id`. The profile keeps app access
 *   (`access_removed_at` stays NULL) so it remains searchable for historic
 *   reasons, while every active-member query (`.eq("team_id", …)`, incl. the
 *   Rocket Model unanimity trigger) stops seeing it.
 * - restore: moves `former_team_id` back into `team_id` and clears the
 *   former-* columns.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const caller = await getCurrentUserProfile(supabase, { user })
    if (!caller || caller.role !== "admin")
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Neplatná data" }, { status: 400 })

    const { profileId, action } = parsed.data
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target, error: fetchError } = await (admin as any)
      .from("profiles")
      .select("id, team_id, former_team_id, access_removed_at")
      .eq("id", profileId)
      .maybeSingle()

    if (fetchError) {
      serverLogger.console.error("Admin team-members fetch error:", fetchError)
      return NextResponse.json({ error: "Nepodařilo se načíst profil" }, { status: 500 })
    }
    if (!target) return NextResponse.json({ error: "Profil nenalezen" }, { status: 404 })

    if (action === "remove") {
      if (profileId === caller.id)
        return NextResponse.json({ error: "Nemůžeš odebrat sebe sama" }, { status: 400 })
      if (!target.team_id)
        return NextResponse.json({ error: "Profil není členem žádného týmu" }, { status: 400 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any)
        .from("profiles")
        .update({
          team_id: null,
          former_team_id: target.team_id,
          team_left_at: new Date().toISOString(),
          team_removed_by_profile_id: caller.id,
        })
        .eq("id", profileId)
        .select("id, team_id, former_team_id")
        .single()

      if (error) {
        serverLogger.console.error("Admin team-members remove error:", error)
        return NextResponse.json({ error: "Nepodařilo se odebrat z týmu" }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    // restore
    if (target.team_id)
      return NextResponse.json({ error: "Profil již je členem týmu" }, { status: 400 })
    if (!target.former_team_id)
      return NextResponse.json({ error: "Profil nemá žádný předchozí tým" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("profiles")
      .update({
        team_id: target.former_team_id,
        former_team_id: null,
        team_left_at: null,
        team_removed_by_profile_id: null,
      })
      .eq("id", profileId)
      .select("id, team_id, former_team_id")
      .single()

    if (error) {
      serverLogger.console.error("Admin team-members restore error:", error)
      return NextResponse.json({ error: "Nepodařilo se vrátit do týmu" }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    serverLogger.console.error("PATCH /api/admin/team-members error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
