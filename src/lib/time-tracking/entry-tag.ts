import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import { TIME_TRACKING_MESSAGES } from "./constants"
import { findOrCreateTeamTag, isUsableTag } from "./queries"
import type { TimeDirection } from "./types"

export interface EntryTagInput {
  direction: TimeDirection
  /** `undefined` = unchanged (PATCH), `null` = no tag. */
  tagId?: string | null
  /** Draft name of a team tag to create or reuse on save. */
  newTagName?: string
}

export type EntryTagResult =
  | { ok: true; tagId: string | null | undefined }
  | { ok: false; message: string }

/**
 * Turns the tag part of an entry request into the `tag_id` to store: checks that an existing
 * tag is usable by the profile (system tag or own team) and creates the team tag for a draft
 * name. `tagId: undefined` in the result means "leave unchanged".
 */
export async function resolveEntryTag(
  supabase: SupabaseClient<Database>,
  profile: { id: string; team_id: string | null },
  input: EntryTagInput,
): Promise<EntryTagResult> {
  if (input.newTagName !== undefined) {
    if (profile.team_id === null) return { ok: false, message: TIME_TRACKING_MESSAGES.tagNeedsTeam }
    const tag = await findOrCreateTeamTag(
      supabase,
      { id: profile.id, team_id: profile.team_id },
      input.direction,
      input.newTagName,
    )
    return { ok: true, tagId: tag.id }
  }

  if (input.tagId !== undefined && input.tagId !== null && !(await isUsableTag(supabase, profile.team_id, input.tagId))) {
    return { ok: false, message: TIME_TRACKING_MESSAGES.invalidTag }
  }
  return { ok: true, tagId: input.tagId }
}
