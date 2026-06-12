import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, type Profile } from "@/lib/auth-helpers";

/**
 * Request-scoped profile fetch for server components.
 * React cache() dedupes calls within a single request, so the (main) layout
 * and any page/component can call this freely — only one query runs.
 * Always includes the team relation (the join is part of the same query).
 *
 * Server-only: lives in its own module (not auth-helpers) so client bundles
 * never import next/headers via createClient.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  return getCurrentUserProfile(supabase, { includeTeam: true });
});
