import { NextResponse } from "next/server"

import { invalidIdFailure, isApiFailure, isValidId, requireTsApiContext, rpcFailure } from "../../_shared"

interface RouteParams {
  params: Promise<{ id: string }>
}

async function handle(rpc: "join_training_session" | "leave_training_session", params: RouteParams["params"]) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const { id } = await params
  if (!isValidId(id)) return invalidIdFailure().response

  const { data, error } = await context.supabase.rpc(rpc, { p_session_id: id })
  if (error) return rpcFailure(error).response
  return NextResponse.json({ data: { guestCount: data } })
}

export async function POST(_request: Request, { params }: RouteParams) {
  return handle("join_training_session", params)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  return handle("leave_training_session", params)
}
