import { z } from "zod"

import { canManageTeamCalendar } from "@/lib/training-sessions/calendar-sync-events"

import { errorResponse, isApiFailure, parseJson, requireTsApiContext, type ApiFailure, type TsApiContext } from "../_shared"

const HTTP_FORBIDDEN = 403

export const teamBodySchema = z.object({ teamId: z.uuid() })

/** Parses `{ teamId, ... }` and asserts the caller may manage that team's calendar. */
export async function requireCalendarManager<T extends { teamId: string }>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ context: TsApiContext; input: T } | ApiFailure> {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context
  const input = await parseJson(request, schema)
  if (isApiFailure(input)) return input
  if (!canManageTeamCalendar({ role: context.role, teamId: context.teamId }, input.teamId)) {
    return errorResponse("Kalendář tohoto týmu nemůžeš spravovat", HTTP_FORBIDDEN)
  }
  return { context, input }
}
