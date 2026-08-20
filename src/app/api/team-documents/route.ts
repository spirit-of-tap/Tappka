import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import type { Insertable } from "@/lib/supabase/tables"
import { validateCreateDocumentInput } from "@/lib/team-documents/validation"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile?.team_id) {
      return NextResponse.json({ error: "Nemáte přiřazený tým" }, { status: 403 })
    }

    const validation = validateCreateDocumentInput(await request.json())
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const payload: Insertable<"team_documents"> = {
      team_id: profile.team_id,
      doc_type: validation.data.docType,
      title: validation.data.title,
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    }
    const { data, error } = await supabase
      .from("team_documents")
      .insert(payload)
      .select()
      .single()

    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Tento zvýrazněný dokument už tým má" },
        { status: 409 },
      )
    }
    if (error || !data) {
      console.error("POST /api/team-documents insert error:", error)
      return NextResponse.json({ error: "Dokument se nepodařilo vytvořit" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("POST /api/team-documents error:", error)
    return NextResponse.json({ error: "Dokument se nepodařilo vytvořit" }, { status: 500 })
  }
}
