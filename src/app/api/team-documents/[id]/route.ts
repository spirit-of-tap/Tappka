import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import type { Updatable } from "@/lib/supabase/tables"
import { validateCreateDocumentInput } from "@/lib/team-documents/validation"
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile?.team_id) {
      return NextResponse.json({ error: "Nemáte přiřazený tým" }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabase
      .from("team_documents")
      .select("id, team_id, doc_type")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle()
    if (existingError || !existing || existing.team_id !== profile.team_id) {
      return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 })
    }
    if (existing.doc_type !== "other") {
      return NextResponse.json(
        { error: "Zvýrazněný dokument nelze přejmenovat" },
        { status: 400 },
      )
    }

    const body: unknown = await request.json()
    const title = typeof body === "object" && body !== null && "title" in body
      ? body.title
      : undefined
    const validation = validateCreateDocumentInput({ docType: "other", title })
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const update: Updatable<"team_documents"> = {
      title: validation.data.title,
      updated_by_profile_id: profile.id,
    }
    const { data, error } = await supabase
      .from("team_documents")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle()
    if (error || !data) {
      return NextResponse.json({ error: "Dokument se nepodařilo přejmenovat" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    serverLogger.console.error("PATCH /api/team-documents/[id] error:", error)
    return NextResponse.json({ error: "Dokument se nepodařilo přejmenovat" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile?.team_id) {
      return NextResponse.json({ error: "Nemáte přiřazený tým" }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabase
      .from("team_documents")
      .select("id, team_id, doc_type")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle()
    if (existingError || !existing || existing.team_id !== profile.team_id) {
      return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 })
    }
    if (existing.doc_type !== "other") {
      return NextResponse.json(
        { error: "Zvýrazněný dokument nelze archivovat" },
        { status: 400 },
      )
    }

    const update: Updatable<"team_documents"> = {
      removed_at: new Date().toISOString(),
      updated_by_profile_id: profile.id,
    }
    const { data, error } = await supabase
      .from("team_documents")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle()
    if (error || !data) {
      return NextResponse.json({ error: "Dokument se nepodařilo archivovat" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    serverLogger.console.error("DELETE /api/team-documents/[id] error:", error)
    return NextResponse.json({ error: "Dokument se nepodařilo archivovat" }, { status: 500 })
  }
}
