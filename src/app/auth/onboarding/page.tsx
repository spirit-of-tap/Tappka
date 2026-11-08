import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hasLinkedProfile, hasEmailIdentity } from "@/lib/auth-helpers";
import {
  claimsHaveEmailProvider,
  ONBOARDING_STATE,
  resolveOnboardingState,
} from "@/lib/auth/onboarding-state";
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
 * The state is resolved by `resolveOnboardingState` so this page never
 * redirects into the app while the proxy would bounce the user back here:
 * 1. No email identity → verification wizard (even if a profile is linked)
 * 2. Email verified, no profile → "waiting for approval" screen
 * 3. Set up, but the token predates the email identity → refresh session
 * 4. Set up and the token agrees → redirect into the app
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

  const [hasProfile, hasEmail, { data: claimsData }] = await Promise.all([
    hasLinkedProfile(supabase, user),
    hasEmailIdentity(supabase, user),
    supabase.auth.getClaims(),
  ]);

  const state = resolveOnboardingState({
    hasProfile,
    hasEmailIdentity: hasEmail,
    tokenHasEmailProvider: claimsHaveEmailProvider(claimsData?.claims),
  });

  // Respect the next parameter if provided, otherwise use default logged in page.
  // Validate next to prevent open redirects: next is a user-controllable query
  // param, so an unvalidated server redirect() could be pointed off-origin.
  if (state === ONBOARDING_STATE.APP) {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
    const validatedNext = next ? validateRedirectUrl(next, origin) : null;
    redirect(validatedNext ?? DEFAULT_LOGGED_IN_PAGE);
  }

  // Get the verified CZU email to display on the waiting screen
  const verifiedEmail = hasEmail ? user.email ?? null : null;

  return (
    <OnboardingClient
      next={next}
      state={state}
      verifiedEmail={verifiedEmail}
    />
  );
}
