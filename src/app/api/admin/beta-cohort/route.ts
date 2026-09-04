import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { serverLogger } from "@/lib/server-logger";

const schema = z.object({
  profileId: z.string().uuid(),
  beta_cohort: z.enum(["A", "B"]),
})

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const caller = await getCurrentUserProfile(supabase, { user })
    if (!caller || caller.role !== "admin")
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Neplatná data" }, { status: 400 })

    const { profileId, beta_cohort } = parsed.data
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target, error: fetchError } = await (admin as any)
      .from("profiles")
      .select("id, beta_access_granted_at, beta_cohort")
      .eq("id", profileId)
      .maybeSingle()

    if (fetchError) {
      serverLogger.console.error("Admin beta-cohort fetch error:", fetchError)
      return NextResponse.json({ error: "Nepodařilo se načíst profil" }, { status: 500 })
    }
    if (!target || !target.beta_access_granted_at)
      return NextResponse.json({ error: "Profil nenalezen nebo není v betě" }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("profiles")
      .update({ beta_cohort })
      .eq("id", profileId)
      .select("id, beta_cohort")
      .single()

    if (error) {
      serverLogger.console.error("Admin beta-cohort update error:", error)
      return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    serverLogger.console.error("PATCH /api/admin/beta-cohort error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
