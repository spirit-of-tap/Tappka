import { NextResponse } from "next/server"

import { markTagsReviewed } from "@/lib/time-tracking/queries"
import { requireTimeTrackingContext, unexpectedErrorResponse } from "@/lib/time-tracking/route-auth"

/**
 * POST /api/time-tags/review — the session profile has seen the team's current tags
 * („Ignorovat" in the tag picker, or opening the tag settings); stops announcing them as new.
 */
export async function POST() {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const reviewedAt = await markTagsReviewed(supabase, profile.id, new Date())
    return NextResponse.json({ data: { reviewedAt } })
  } catch (error) {
    return unexpectedErrorResponse("POST /api/time-tags/review", error)
  }
}
