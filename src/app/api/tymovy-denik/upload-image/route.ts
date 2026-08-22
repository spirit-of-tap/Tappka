import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { generateFileKey, uploadFile } from "@/lib/storage/service"
import { getPublicStorageUrl } from "@/lib/storage/public-url"

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/**
 * A backstop only — the form optimizes to WebP client-side first, so real
 * photos arrive well under this. Stops something absurd reaching storage.
 */
const MAX_BYTES = 8 * 1024 * 1024

/**
 * POST /api/tymovy-denik/upload-image
 *
 * Server-side upload of an activity photo into the public images bucket,
 * namespaced per team. Any current member of the team may upload.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile) return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 })
    if (!profile.team_id) return NextResponse.json({ error: "Nejsi členem:kou týmu" }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const teamId = formData.get("teamId") as string | null
    if (!file || !teamId) return NextResponse.json({ error: "Chybí soubor nebo tým" }, { status: 400 })
    if (teamId !== profile.team_id) {
      return NextResponse.json({ error: "Nemáš oprávnění nahrát obrázek pro tento tým" }, { status: 403 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: "Nepodporovaný formát" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: `Soubor je příliš velký (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
        { status: 400 },
      )
    }

    const key = generateFileKey("team-activities", teamId, ext)
    await uploadFile("images", key, buffer, file.type)
    const src = getPublicStorageUrl("images", key)

    return NextResponse.json({ key, src }, { status: 201 })
  } catch (error) {
    console.error("POST /api/tymovy-denik/upload-image error:", error)
    return NextResponse.json({ error: "Nahrávání selhalo" }, { status: 500 })
  }
}
