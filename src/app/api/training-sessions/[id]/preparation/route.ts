import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import type { Json } from "@/lib/supabase/database.types"
import { preparationInputSchema } from "@/lib/training-sessions/validation"

import {
  isApiFailure,
  mutationFailed,
  parseJson,
  requireOwnedSession,
  requireSessionFacilitator,
  requireTsApiContext,
} from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const notFacilitator = await requireSessionFacilitator(context, session.id)
  if (notFacilitator) return notFacilitator.response
  const input = await parseJson(request, preparationInputSchema)
  if (isApiFailure(input)) return input.response

  const { data: existing, error: existingError } = await context.supabase
    .from("training_session_preparations")
    .select("published_at")
    .eq("training_session_id", session.id)
    .maybeSingle()
  if (existingError) return mutationFailed(existingError).response

  // Saving publishes; saving an empty document means there is no preparation.
  const contentText = contentTextFromJson(input.contentJson)
  const publishedAt = contentText === "" ? null : (existing?.published_at ?? new Date().toISOString())

  const content = {
    content_json: input.contentJson as Json,
    content_text: contentText,
    published_at: publishedAt,
    updated_by_profile_id: context.profileId,
  }

  const { error } = existing
    ? await context.supabase
        .from("training_session_preparations")
        .update(content)
        .eq("training_session_id", session.id)
    : await context.supabase
        .from("training_session_preparations")
        .insert({ ...content, training_session_id: session.id, created_by_profile_id: context.profileId })
  if (error) return mutationFailed(error).response
  return NextResponse.json({ data: { publishedAt } })
}
