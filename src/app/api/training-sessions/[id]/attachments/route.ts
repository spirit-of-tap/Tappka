import { NextResponse } from "next/server"
import { z } from "zod"

import { serverLogger } from "@/lib/server-logger"
import { deleteFile, inspectStorageObject } from "@/lib/storage/service"
import { attachmentKeyPrefix, validateAttachmentCandidate } from "@/lib/training-sessions/attachments"
import type { TsAttachmentSummary } from "@/lib/training-sessions/types"

import { errorResponse, isApiFailure, mutationFailed, parseJson } from "../../_shared"
import { requireAttachmentCapacity, requireAttachmentWriter } from "./_shared"

const HTTP_BAD_REQUEST = 400
const HTTP_CREATED = 201
const MISSING_UPLOAD_MESSAGE = "Nahraný soubor se nepodařilo najít, zkus to znovu"

const registerSchema = z.object({
  key: z.string(),
  label: z.string(),
  fileName: z.string(),
})

async function discardUpload(key: string): Promise<void> {
  await deleteFile("documents", key).catch((error: unknown) =>
    serverLogger.console.error("Failed to discard rejected TS attachment upload:", error),
  )
}

/** Registers a file the browser already uploaded via the signed URL from `upload-url`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const writer = await requireAttachmentWriter((await params).id)
  if (isApiFailure(writer)) return writer.response
  const input = await parseJson(request, registerSchema)
  if (isApiFailure(input)) return input.response
  if (!input.key.startsWith(attachmentKeyPrefix(writer.sessionId)) || input.key.includes("..")) {
    return errorResponse("Neplatný klíč souboru", HTTP_BAD_REQUEST).response
  }

  // Trust what storage holds, not what the browser claims.
  let stored: Awaited<ReturnType<typeof inspectStorageObject>>
  try {
    stored = await inspectStorageObject("documents", input.key)
  } catch (error) {
    return mutationFailed(error).response
  }
  if (!stored) return errorResponse(MISSING_UPLOAD_MESSAGE, HTTP_BAD_REQUEST).response

  const invalid = validateAttachmentCandidate({
    label: input.label,
    fileName: input.fileName,
    contentType: stored.contentType,
    fileSize: stored.size,
  })
  if (invalid) {
    await discardUpload(input.key)
    return errorResponse(invalid, HTTP_BAD_REQUEST).response
  }
  const full = await requireAttachmentCapacity(writer.context, writer.sessionId)
  if (full) {
    await discardUpload(input.key)
    return full.response
  }

  const { data, error } = await writer.context.supabase
    .from("training_session_attachments")
    .insert({
      training_session_id: writer.sessionId,
      label: input.label.trim(),
      file_path: input.key,
      file_name: input.fileName.trim(),
      file_size: stored.size,
      content_type: stored.contentType,
      created_by_profile_id: writer.context.profileId,
    })
    .select("id, label, file_name, file_size, content_type")
    .single()
  if (error || !data) {
    await discardUpload(input.key)
    return mutationFailed(error).response
  }
  const attachment: TsAttachmentSummary = data
  return NextResponse.json({ data: attachment }, { status: HTTP_CREATED })
}
