import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import type { Json } from "@/lib/supabase/database.types"
import { scheduleSessionSync } from "@/lib/training-sessions/calendar-sync"
import { preparationInputSchema } from "@/lib/training-sessions/validation"

import { isApiFailure, mutationFailed, parseJson, requirePreparationEditor, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requirePreparationEditor(context, (await params).id)
  if (isApiFailure(session)) return session.response
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
  // The team calendar marks published preparations; only a publish/unpublish changes the event.
  if (Boolean(existing?.published_at) !== Boolean(publishedAt)) scheduleSessionSync(session.id)
  return NextResponse.json({ data: { publishedAt } })
}
