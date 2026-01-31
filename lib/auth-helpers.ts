import { createClient } from "@/lib/supabase/server";

/**
 * Checks if the authenticated user has an email identity linked
 * (not just OAuth providers like Google)
 * @returns true if user has an email identity, false otherwise
 */
export async function hasEmailIdentity(): Promise<boolean> {
  const supabase = await createClient();
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

  // Get the public.users row linked to this auth user
  const { data: publicUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!publicUser) {
    return false;
  }

  // Check if there's a profile linked to this user
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", publicUser.id)
    .single();

  return !!profile;
}
