import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"

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

    const { error } = await supabase
      .from("profiles")
      .update({ beta_access })
      .eq("id", profile.id)

    if (error) {
      console.error("Error updating beta_access:", error)
      return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
    }

    return NextResponse.json({ beta_access })
  } catch (error) {
    console.error("Beta access update error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
