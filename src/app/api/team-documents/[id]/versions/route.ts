import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { createClient } from "@/lib/supabase/server"
import type { Insertable } from "@/lib/supabase/tables"
import { validateVersionInput } from "@/lib/team-documents/validation"
import { serverLogger } from "@/lib/server-logger";

const MAX_VERSION_INSERT_ATTEMPTS = 2

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile?.team_id) {
      return NextResponse.json({ error: "Nemáte přiřazený tým" }, { status: 403 })
    }

    const { data: document, error: documentError } = await supabase
      .from("team_documents")
      .select("id, team_id")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle()
    if (documentError || !document || document.team_id !== profile.team_id) {
      return NextResponse.json({ error: "Dokument nenalezen" }, { status: 404 })
    }

    const validation = validateVersionInput(await request.json(), id)
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    for (let attempt = 0; attempt < MAX_VERSION_INSERT_ATTEMPTS; attempt += 1) {
      const { data: latest, error: latestError } = await supabase
        .from("team_document_versions")
        .select("version_no")
        .eq("document_id", id)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latestError) throw latestError

      const payload: Insertable<"team_document_versions"> = {
        document_id: id,
        version_no: (latest?.version_no ?? 0) + 1,
        file_path: validation.data.key,
        file_name: validation.data.fileName,
        file_size: validation.data.fileSize,
        effective_from: validation.data.effectiveFrom,
        change_note: validation.data.changeNote,
        created_by_profile_id: profile.id,
      }
      const { data, error } = await supabase
        .from("team_document_versions")
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        return NextResponse.json({
          success: true,
          data: {
            ...data,
            created_by: {
              id: profile.id,
              name: profile.name,
              picture: profile.picture,
            },
          },
        }, { status: 201 })
      }
      if (error?.code !== "23505" || attempt === MAX_VERSION_INSERT_ATTEMPTS - 1) {
        serverLogger.console.error("POST /api/team-documents/[id]/versions insert error:", error)
        return NextResponse.json({ error: "Verzi se nepodařilo uložit" }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "Verzi se nepodařilo uložit" }, { status: 500 })
  } catch (error) {
    serverLogger.console.error("POST /api/team-documents/[id]/versions error:", error)
    return NextResponse.json({ error: "Verzi se nepodařilo uložit" }, { status: 500 })
  }
}
