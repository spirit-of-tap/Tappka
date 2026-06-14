import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hasLinkedProfile, hasEmailIdentity } from "@/lib/auth-helpers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";
import { OnboardingClient } from "./onboarding-client";

interface OnboardingPageProps {
  searchParams: Promise<{ next?: string }>;
}

/**
 * Onboarding page for first-time users
 * Guides users through email verification with a wizard interface
 *
 * Handles two distinct states:
 * 1. User needs to verify their CZU email → shows the verification wizard
 * 2. User verified email but no profile exists → shows "waiting for approval" screen
 */
export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect("/auth/login");
  }

  // Get search params
  const params = await searchParams;
  const next = params.next;

  // Redirect to protected if already has linked profile
  // Respect the next parameter if provided, otherwise use default logged in page.
  // Validate next to prevent open redirects: next is a user-controllable query
  // param, so an unvalidated server redirect() could be pointed off-origin.
  const hasProfile = await hasLinkedProfile(supabase, user);
  if (hasProfile) {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
    const validatedNext = next ? validateRedirectUrl(next, origin) : null;
    redirect(validatedNext ?? DEFAULT_LOGGED_IN_PAGE);
  }

  // Check if user already has a verified email identity
  // If yes → they verified but no profile exists → show "waiting for approval"
  // If no → they still need to verify → show the wizard
  const hasEmail = await hasEmailIdentity(supabase, user);

  // Get the verified CZU email to display on the waiting screen
  const verifiedEmail = hasEmail ? user.email ?? null : null;

  return (
    <OnboardingClient
      next={next}
      hasEmail={hasEmail}
      verifiedEmail={verifiedEmail}
    />
  );
}
