import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import type { Json } from "@/lib/supabase/database.types"
import { preparationInputSchema } from "@/lib/training-sessions/validation"

import { isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const input = await parseJson(request, preparationInputSchema)
  if (isApiFailure(input)) return input.response

  const { data: existing, error: existingError } = await context.supabase
    .from("training_session_preparations")
    .select("published_at")
    .eq("training_session_id", session.id)
    .maybeSingle()
  if (existingError) return mutationFailed(existingError).response

  const currentPublishedAt = existing?.published_at ?? null
  const publishedAt =
    input.action === "publish"
      ? (currentPublishedAt ?? new Date().toISOString())
      : input.action === "unpublish"
        ? null
        : currentPublishedAt

  const content = {
    content_json: input.contentJson as Json,
    content_text: contentTextFromJson(input.contentJson),
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
