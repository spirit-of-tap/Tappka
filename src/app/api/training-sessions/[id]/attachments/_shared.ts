import { TS_ATTACHMENT_LIMITS, TS_ATTACHMENT_MESSAGES } from "@/lib/training-sessions/attachments"

import {
  errorResponse,
  isApiFailure,
  mutationFailed,
  requirePreparationEditor,
  requireTsApiContext,
  type ApiFailure,
  type TsApiContext,
} from "../../_shared"

const HTTP_CONFLICT = 409

/** Attachments follow the preparation they support: facilitators, or an admin for any session. */
export async function requireAttachmentWriter(
  sessionIdParam: string,
): Promise<{ context: TsApiContext; sessionId: string } | ApiFailure> {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context
  const session = await requirePreparationEditor(context, sessionIdParam)
  if (isApiFailure(session)) return session
  return { context, sessionId: session.id }
}

export async function requireAttachmentCapacity(context: TsApiContext, sessionId: string): Promise<ApiFailure | null> {
  const { count, error } = await context.supabase
    .from("training_session_attachments")
    .select("id", { count: "exact", head: true })
    .eq("training_session_id", sessionId)
  if (error) return mutationFailed(error)
  if ((count ?? 0) >= TS_ATTACHMENT_LIMITS.maxPerSession) {
    return errorResponse(TS_ATTACHMENT_MESSAGES.tooMany, HTTP_CONFLICT)
  }
  return null
}
