import { NextResponse } from "next/server"
import { z } from "zod"

import { generatePresignedUploadForKey, generatePrivateStorageKey } from "@/lib/storage/service"
import {
  attachmentKeyPrefix,
  TS_ATTACHMENT_TYPES,
  validateAttachmentCandidate,
} from "@/lib/training-sessions/attachments"

import { errorResponse, isApiFailure, mutationFailed, parseJson } from "../../../_shared"
import { requireAttachmentCapacity, requireAttachmentWriter } from "../_shared"

const HTTP_BAD_REQUEST = 400

const uploadUrlSchema = z.object({
  label: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const writer = await requireAttachmentWriter((await params).id)
  if (isApiFailure(writer)) return writer.response
  const input = await parseJson(request, uploadUrlSchema)
  if (isApiFailure(input)) return input.response

  const invalid = validateAttachmentCandidate(input)
  if (invalid) return errorResponse(invalid, HTTP_BAD_REQUEST).response
  const full = await requireAttachmentCapacity(writer.context, writer.sessionId)
  if (full) return full.response

  try {
    const extension = TS_ATTACHMENT_TYPES[input.contentType as keyof typeof TS_ATTACHMENT_TYPES]
    const key = generatePrivateStorageKey(attachmentKeyPrefix(writer.sessionId), extension)
    const upload = await generatePresignedUploadForKey("documents", key)
    return NextResponse.json({ data: { url: upload.url, key: upload.key } })
  } catch (error) {
    return mutationFailed(error).response
  }
}
