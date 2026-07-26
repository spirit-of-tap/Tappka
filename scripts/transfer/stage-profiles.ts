import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId } from "./profile-map";
import { insertRows, patchRows } from "./rest";

export const SYSTEM_PROFILE_EMAIL = "admin@studenti.czu.cz";

export interface ProfileStageReport {
  readonly inserted: number;
  readonly teamPatched: number;
}

function toInsertRow(
  profile: Tables<"profiles">,
  plan: TransferPlan,
): TablesInsert<"profiles"> {
  return {
    ...profile,
    // Auth users are environment-specific, so inserted profiles are unlinked (R7).
    user_id: null,
    access_removed_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.access_removed_by_profile_id,
    ),
    created_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.created_by_profile_id,
    ),
    updated_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.updated_by_profile_id,
    ),
  };
}

/**
 * Rows to insert, System first: every self-referencing
 * `created_by_profile_id` in the source points at it, and those FKs are
 * NOT NULL / ON DELETE RESTRICT.
 */
export function buildProfileInsertRows(plan: TransferPlan): TablesInsert<"profiles">[] {
  const rows = plan.sourceProfiles
    .filter((profile) => plan.profileMap.insertIds.has(profile.id))
    .map((profile) => toInsertRow(profile, plan));

  return rows.sort((a, b) => {
    const aSystem = a.work_email === SYSTEM_PROFILE_EMAIL ? 0 : 1;
    const bSystem = b.work_email === SYSTEM_PROFILE_EMAIL ? 0 : 1;
    return aSystem - bSystem;
  });
}

export async function transferProfiles(
  target: Endpoint,
  plan: TransferPlan,
): Promise<ProfileStageReport> {
  const rows = buildProfileInsertRows(plan);

  // One request: FK triggers are AFTER ROW and fire at statement end, so the
  // rows referencing System resolve within the same statement.
  await insertRows(target, "profiles", rows);

  let teamPatched = 0;
  for (const collision of plan.profileMap.collisions) {
    const sourceProfile = plan.sourceProfiles.find((p) => p.id === collision.sourceId);
    if (sourceProfile?.team_id == null) continue;

    // Skip when the target already holds this team. `handle_updated_at` is a
    // BEFORE UPDATE trigger, so even a PATCH that changes nothing would stamp
    // `updated_at = now()` and destroy the timestamp R1 requires. On a resume
    // every source profile is a collision, so without this guard the run would
    // re-stamp every profile it had previously inserted.
    const targetProfile = plan.targetProfiles.find((p) => p.id === collision.targetId);
    if (targetProfile?.team_id === sourceProfile.team_id) continue;

    // team_id is the ONLY column ever written to an existing target profile (R3).
    await patchRows(target, "profiles", `id=eq.${collision.targetId}`, {
      team_id: sourceProfile.team_id,
    });
    teamPatched += 1;
  }

  return { inserted: rows.length, teamPatched };
}
