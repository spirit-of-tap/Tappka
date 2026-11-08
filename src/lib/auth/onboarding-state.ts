/**
 * Where an authenticated user belongs during onboarding.
 *
 * The proxy gates on the JWT's `app_metadata.providers` (fast, but can be
 * stale), while the onboarding page sees the live identities and profile link.
 * Both must agree, otherwise the proxy sends the user to onboarding and the
 * page sends them straight back — an infinite redirect loop.
 */
export const ONBOARDING_STATE = {
  /** Fully set up and the token proves it — safe to enter the app. */
  APP: "app",
  /** Set up, but the token predates the email identity — refresh it first. */
  REFRESH_SESSION: "refresh-session",
  /** Email verified, but no admin-linked profile yet. */
  WAITING: "waiting",
  /** No email identity yet — show the verification wizard. */
  VERIFY: "verify",
} as const;

export type OnboardingState = (typeof ONBOARDING_STATE)[keyof typeof ONBOARDING_STATE];

const EMAIL_PROVIDER = "email";

interface OnboardingStateInput {
  hasProfile: boolean;
  /** The live auth user has an `email` identity. */
  hasEmailIdentity: boolean;
  /** The current JWT's `app_metadata.providers` includes `email` (what the proxy checks). */
  tokenHasEmailProvider: boolean;
}

export function resolveOnboardingState({
  hasProfile,
  hasEmailIdentity,
  tokenHasEmailProvider,
}: OnboardingStateInput): OnboardingState {
  // A linked profile alone is not enough: without the email identity the
  // proxy would bounce the user back here, so let them verify instead.
  if (!hasEmailIdentity) return ONBOARDING_STATE.VERIFY;
  if (!hasProfile) return ONBOARDING_STATE.WAITING;
  if (!tokenHasEmailProvider) return ONBOARDING_STATE.REFRESH_SESSION;
  return ONBOARDING_STATE.APP;
}

/**
 * Reads `app_metadata.providers` from JWT claims — the exact signal the proxy
 * uses to decide whether a user must finish onboarding.
 */
export function claimsHaveEmailProvider(
  claims: { app_metadata?: unknown } | null | undefined,
): boolean {
  const providers = (claims?.app_metadata as { providers?: unknown } | undefined)?.providers;
  return Array.isArray(providers) && providers.includes(EMAIL_PROVIDER);
}

export const AUTH_ERROR_CODES = {
  EMAIL_EXISTS: "email_exists",
  EMAIL_RATE_LIMIT: "over_email_send_rate_limit",
} as const;

export const EMAIL_LINK_ERROR_MESSAGES = {
  EMAIL_EXISTS:
    "Tenhle ČZU email už je propojený s jiným účtem. Odhlas se a přihlas se přes Google účet, ke kterému email patří. Pokud nevíš, který to je, ozvi se nám.",
  EMAIL_RATE_LIMIT: "Kódů odešlo moc najednou. Počkej chvilku a zkus to znovu.",
  FALLBACK: "Nepodařilo se poslat kód, zkus to znovu",
} as const;

/**
 * Maps a Supabase Auth error from `updateUser({ email })` to Czech copy.
 * Branches on the stable error `code`, never on the English message text.
 */
export function getEmailLinkErrorMessage(error: { code?: string | null }): string {
  switch (error.code) {
    case AUTH_ERROR_CODES.EMAIL_EXISTS:
      return EMAIL_LINK_ERROR_MESSAGES.EMAIL_EXISTS;
    case AUTH_ERROR_CODES.EMAIL_RATE_LIMIT:
      return EMAIL_LINK_ERROR_MESSAGES.EMAIL_RATE_LIMIT;
    default:
      return EMAIL_LINK_ERROR_MESSAGES.FALLBACK;
  }
}
