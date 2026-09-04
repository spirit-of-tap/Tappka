import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getSignedStorageUrl } from "@/lib/storage/service"
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { versionId } = await params
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const { data, error } = await supabase
      .from("team_document_versions")
      .select("file_path")
      .eq("id", versionId)
      .maybeSingle()
    if (error || !data) {
      return NextResponse.json({ error: "Verze nenalezena" }, { status: 404 })
    }

    const url = await getSignedStorageUrl("documents", data.file_path)
    return NextResponse.redirect(url, 307)
  } catch (error) {
    serverLogger.console.error("GET /api/team-documents/versions/[versionId]/open error:", error)
    return NextResponse.json({ error: "Soubor se nepodařilo otevřít" }, { status: 500 })
  }
}
