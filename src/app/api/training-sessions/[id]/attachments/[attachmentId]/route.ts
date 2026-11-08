import { NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import { deleteFile, getSignedStorageUrl } from "@/lib/storage/service"

import {
  errorResponse,
  invalidIdFailure,
  isApiFailure,
  isValidId,
  mutationFailed,
  requireTsApiContext,
} from "../../../_shared"
import { requireAttachmentWriter } from "../_shared"

const HTTP_NOT_FOUND = 404
const HTTP_TEMPORARY_REDIRECT = 307
const NOT_FOUND_MESSAGE = "Příloha nebyla nalezena"

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>
}

/** Opens the file: RLS decides visibility (same as the preparation), then a short-lived signed URL. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, attachmentId } = await params
  if (!isValidId(id) || !isValidId(attachmentId)) return invalidIdFailure().response
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response

  const { data, error } = await context.supabase
    .from("training_session_attachments")
    .select("file_path, file_name")
    .eq("id", attachmentId)
    .eq("training_session_id", id)
    .maybeSingle()
  if (error) return mutationFailed(error).response
  if (!data) return errorResponse(NOT_FOUND_MESSAGE, HTTP_NOT_FOUND).response

  try {
    const url = await getSignedStorageUrl("documents", data.file_path, undefined, data.file_name)
    return NextResponse.redirect(url, HTTP_TEMPORARY_REDIRECT)
  } catch (signError) {
    return mutationFailed(signError).response
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, attachmentId } = await params
  if (!isValidId(attachmentId)) return invalidIdFailure().response
  const writer = await requireAttachmentWriter(id)
  if (isApiFailure(writer)) return writer.response

  const { data, error } = await writer.context.supabase
    .from("training_session_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("training_session_id", writer.sessionId)
    .select("file_path")
    .maybeSingle()
  if (error) return mutationFailed(error).response
  if (!data) return errorResponse(NOT_FOUND_MESSAGE, HTTP_NOT_FOUND).response

  // The row is gone, so the file is unreachable either way; a failed cleanup only leaves an orphan.
  await deleteFile("documents", data.file_path).catch((cleanupError: unknown) =>
    serverLogger.console.error("Failed to delete TS attachment file:", cleanupError),
  )
  return NextResponse.json({ data: { id: attachmentId } })
}
