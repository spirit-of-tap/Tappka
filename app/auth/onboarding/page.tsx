import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasLinkedProfile } from "@/lib/auth-helpers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { OnboardingClient } from "./onboarding-client";

interface OnboardingPageProps {
  searchParams: Promise<{ next?: string }>;
}

/**
 * Onboarding page for first-time users
 * Guides users through email verification with a wizard interface
 */
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to login if not authenticated
  if (!data?.claims) {
    redirect("/auth/login");
  }

  // Get search params
  const params = await searchParams;
  const next = params.next;

  // Redirect to protected if already has linked profile
  // Respect the next parameter if provided, otherwise use default logged in page
  const hasProfile = await hasLinkedProfile(supabase);
  if (hasProfile) {
    redirect(next ?? DEFAULT_LOGGED_IN_PAGE);
  }

  return <OnboardingClient next={next} />;
}
