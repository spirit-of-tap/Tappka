import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { serverLogger } from "@/lib/server-logger";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })
    }

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 })
    }

    const body = await request.json()
    const { beta_access } = body

    if (typeof beta_access !== "boolean") {
      return NextResponse.json({ error: "Neplatná hodnota" }, { status: 400 })
    }

    const beta_access_granted_at = beta_access ? new Date().toISOString() : null
    const patch: Record<string, unknown> = { beta_access_granted_at }
    const currentCohort = (profile as unknown as { beta_cohort?: string | null }).beta_cohort
    if (beta_access && !currentCohort) patch.beta_cohort = "A"

    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", profile.id)

    if (error) {
      serverLogger.console.error("Error updating beta_access_granted_at:", error)
      return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
    }

    return NextResponse.json({ beta_access, beta_access_granted_at })
  } catch (error) {
    serverLogger.console.error("Beta access update error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
