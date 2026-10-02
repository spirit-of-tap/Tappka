import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import type { Json } from "@/lib/supabase/database.types"
import { reflectionInputSchema } from "@/lib/training-sessions/validation"

import {
  errorResponse,
  isApiFailure,
  mutationFailed,
  parseJson,
  requireOwnedSession,
  requireTsApiContext,
} from "../../_shared"

const HTTP_CONFLICT = 409

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  if (new Date(session.starts_at).getTime() > Date.now()) {
    return errorResponse("Reflexi lze psát až po začátku TS", HTTP_CONFLICT).response
  }
  const input = await parseJson(request, reflectionInputSchema)
  if (isApiFailure(input)) return input.response

  const { data: existing, error: existingError } = await context.supabase
    .from("training_session_reflections")
    .select("training_session_id")
    .eq("training_session_id", session.id)
    .maybeSingle()
  if (existingError) return mutationFailed(existingError).response

  const content = {
    content_json: input.contentJson as Json,
    content_text: contentTextFromJson(input.contentJson),
    updated_by_profile_id: context.profileId,
  }

  const { error } = existing
    ? await context.supabase
        .from("training_session_reflections")
        .update(content)
        .eq("training_session_id", session.id)
    : await context.supabase
        .from("training_session_reflections")
        .insert({ ...content, training_session_id: session.id, created_by_profile_id: context.profileId })
  if (error) return mutationFailed(error).response
  return NextResponse.json({ data: { ok: true } })
}
