import { describe, it, expect } from "vitest";

import {
  claimsHaveEmailProvider,
  EMAIL_LINK_ERROR_MESSAGES,
  getEmailLinkErrorMessage,
  ONBOARDING_STATE,
  resolveOnboardingState,
} from "./onboarding-state";

describe("resolveOnboardingState", () => {
  it("enters the app only when profile, identity and token all agree", () => {
    expect(
      resolveOnboardingState({ hasProfile: true, hasEmailIdentity: true, tokenHasEmailProvider: true }),
    ).toBe(ONBOARDING_STATE.APP);
  });

  it("shows the wizard for a linked profile without an email identity (no redirect loop)", () => {
    // The proxy sends such users to onboarding; redirecting them back into the
    // app here would loop forever.
    expect(
      resolveOnboardingState({ hasProfile: true, hasEmailIdentity: false, tokenHasEmailProvider: false }),
    ).toBe(ONBOARDING_STATE.VERIFY);
  });

  it("asks for a session refresh when the token predates the email identity", () => {
    expect(
      resolveOnboardingState({ hasProfile: true, hasEmailIdentity: true, tokenHasEmailProvider: false }),
    ).toBe(ONBOARDING_STATE.REFRESH_SESSION);
  });

  it("shows the waiting screen when the email is verified but no profile is linked", () => {
    expect(
      resolveOnboardingState({ hasProfile: false, hasEmailIdentity: true, tokenHasEmailProvider: true }),
    ).toBe(ONBOARDING_STATE.WAITING);
    expect(
      resolveOnboardingState({ hasProfile: false, hasEmailIdentity: true, tokenHasEmailProvider: false }),
    ).toBe(ONBOARDING_STATE.WAITING);
  });

  it("shows the wizard for a fresh OAuth-only user", () => {
    expect(
      resolveOnboardingState({ hasProfile: false, hasEmailIdentity: false, tokenHasEmailProvider: false }),
    ).toBe(ONBOARDING_STATE.VERIFY);
  });

  it("never resolves to APP when the proxy would bounce the user back", () => {
    for (const hasProfile of [true, false]) {
      for (const hasEmailIdentity of [true, false]) {
        const state = resolveOnboardingState({ hasProfile, hasEmailIdentity, tokenHasEmailProvider: false });
        expect(state).not.toBe(ONBOARDING_STATE.APP);
      }
    }
  });
});

describe("claimsHaveEmailProvider", () => {
  it("detects the email provider in app_metadata.providers", () => {
    expect(claimsHaveEmailProvider({ app_metadata: { providers: ["google", "email"] } })).toBe(true);
  });

  it("is false for OAuth-only, missing or malformed claims", () => {
    expect(claimsHaveEmailProvider({ app_metadata: { providers: ["google"] } })).toBe(false);
    expect(claimsHaveEmailProvider({ app_metadata: { providers: "email" } })).toBe(false);
    expect(claimsHaveEmailProvider({ app_metadata: {} })).toBe(false);
    expect(claimsHaveEmailProvider({})).toBe(false);
    expect(claimsHaveEmailProvider(null)).toBe(false);
    expect(claimsHaveEmailProvider(undefined)).toBe(false);
  });
});

describe("getEmailLinkErrorMessage", () => {
  it("maps email_exists to Czech guidance about the other Google account", () => {
    expect(getEmailLinkErrorMessage({ code: "email_exists" })).toBe(EMAIL_LINK_ERROR_MESSAGES.EMAIL_EXISTS);
  });

  it("maps the email rate limit", () => {
    expect(getEmailLinkErrorMessage({ code: "over_email_send_rate_limit" })).toBe(
      EMAIL_LINK_ERROR_MESSAGES.EMAIL_RATE_LIMIT,
    );
  });

  it("falls back to a generic Czech message instead of raw English text", () => {
    expect(getEmailLinkErrorMessage({ code: "unexpected_failure" })).toBe(EMAIL_LINK_ERROR_MESSAGES.FALLBACK);
    expect(getEmailLinkErrorMessage({})).toBe(EMAIL_LINK_ERROR_MESSAGES.FALLBACK);
  });
});
