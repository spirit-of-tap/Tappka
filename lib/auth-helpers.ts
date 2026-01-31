import { createClient } from "@/lib/supabase/server";

/**
 * Checks if the authenticated user has an email identity linked
 * (not just OAuth providers like Google)
 * @param supabaseClient - Optional Supabase client to use. If not provided, creates a new client.
 * @returns true if user has an email identity, false otherwise
 */
export async function hasEmailIdentity(
  supabaseClient?: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const supabase = supabaseClient ?? await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  // Check if user has an email identity (not just OAuth)
  // User identities include: email, google, etc.
  // We need at least one email identity
  const identities = user.identities || [];

  // Check if any identity is an email identity (not OAuth)
  return identities.some(
    (identity) => identity.provider === "email"
  );
}

/**
 * Checks if the authenticated user has a linked profile
 * @returns true if user has a linked profile, false otherwise
 */
export async function hasLinkedProfile(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  // Single query using nested select to check for linked profile
  // Joins users and profiles tables in a single database call
  const { data: userWithProfile } = await supabase
    .from("users")
    .select("profiles(id)")
    .eq("auth_user_id", user.id)
    .single();

  return !!userWithProfile?.profiles && userWithProfile.profiles.length > 0;
}
