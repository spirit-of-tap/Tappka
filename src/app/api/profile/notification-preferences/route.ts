import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"

const TOGGLE_KEYS = ["essay_coach_read_email", "essay_comment_email", "essay_vote_email"] as const
type ToggleKey = (typeof TOGGLE_KEYS)[number]

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile) return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 })

    const body = await request.json()
    const updates: Partial<Record<ToggleKey, boolean>> = {}
    for (const key of TOGGLE_KEYS) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json({ error: "Neplatná hodnota" }, { status: 400 })
        }
        updates[key] = body[key]
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Žádné změny" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("essay_coach_read_email, essay_comment_email, essay_vote_email, created_by_profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle()

    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          profile_id: profile.id,
          essay_coach_read_email: existing?.essay_coach_read_email ?? true,
          essay_comment_email: existing?.essay_comment_email ?? true,
          essay_vote_email: existing?.essay_vote_email ?? true,
          ...updates,
          created_by_profile_id: existing?.created_by_profile_id ?? profile.id,
          updated_by_profile_id: profile.id,
        },
        { onConflict: "profile_id" },
      )
      .select()
      .single()

    if (error) {
      console.error("PATCH notification-preferences error:", error)
      return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("PATCH /api/profile/notification-preferences error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
