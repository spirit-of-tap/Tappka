import { NextResponse } from "next/server"
import { z } from "zod"

import { errorResponse, invalidIdFailure, isApiFailure, isValidId, requireTsApiContext, rpcFailure } from "../../_shared"

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Present only when a facilitator removes another person's cross sign-up. */
const removalBody = z.object({ profileId: z.uuid() }).strict()

const HTTP_BAD_REQUEST = 400

/** Returns the target profile id, null for self-leave, or "invalid" for a malformed body. */
async function parseRemovalBody(request: Request): Promise<string | null | "invalid"> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null
  const parsed = removalBody.safeParse(await request.json().catch(() => null))
  return parsed.success ? parsed.data.profileId : "invalid"
}

async function handle(rpc: "join_training_session" | "leave_training_session", params: RouteParams["params"]) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const { id } = await params
  if (!isValidId(id)) return invalidIdFailure().response

  const { data, error } = await context.supabase.rpc(rpc, { p_session_id: id })
  if (error) return rpcFailure(error)
  return NextResponse.json({ data: { guestCount: data } })
}

export async function POST(_request: Request, { params }: RouteParams) {
  return handle("join_training_session", params)
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const target = await parseRemovalBody(request)
  if (target === "invalid") return errorResponse("Neplatný požadavek", HTTP_BAD_REQUEST).response

  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const { id } = await params
  if (!isValidId(id)) return invalidIdFailure().response

  const { data, error } =
    target === null
      ? await context.supabase.rpc("leave_training_session", { p_session_id: id })
      : await context.supabase.rpc("remove_training_session_guest", { p_session_id: id, p_profile_id: target })
  if (error) return rpcFailure(error)
  return NextResponse.json({ data: { guestCount: data } })
}
