"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn, validateRedirectUrl } from "@/lib/utils";
import { isValidWorkEmailDomain, OTP_LENGTH, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { hasLinkedProfile } from "@/lib/auth-helpers";

const STORAGE_KEY = "verify-email-form-state";

interface StoredState {
  step: "email" | "otp";
  email: string;
}

/**
 * Loads persisted form state from sessionStorage
 */
const loadPersistedState = (): Partial<StoredState> => {
  if (typeof window === "undefined") return {};

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredState;
    }
  } catch (err) {
    // Ignore errors reading from storage
  }

  return {};
};

/**
 * Saves form state to sessionStorage
 */
const savePersistedState = (state: StoredState) => {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Ignore errors writing to storage
  }
};

/**
 * Clears persisted form state from sessionStorage
 */
const clearPersistedState = () => {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // Ignore errors clearing storage
  }
};

interface VerifyEmailFormProps {
  next?: string;
  wizardMode?: boolean;
  onStepChange?: (step: "email" | "otp") => void;
}

/**
 * Form component for email verification via OTP
 * Allows users to link an email identity to their Google OAuth account
 * Supports wizard mode for onboarding flow
 */
export function VerifyEmailForm({ next, wizardMode = false, onStepChange }: VerifyEmailFormProps) {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSubmittedOtp, setLastSubmittedOtp] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  /**
   * Sends OTP code to the provided email
   * Uses updateUser to add email identity to the current authenticated user
   * This is the correct way to link an email identity to an existing OAuth account
   */
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Check if user already has a linked profile
      // Once linked, email changes are not allowed to maintain profile connection
      const hasProfile = await hasLinkedProfile(supabase);
      if (hasProfile) {
        setError("Email už nejde změnit, protože je propojený s tvým profilem. Díky němu tě poznáváme!");
        setIsLoading(false);
        return;
      }

      // Validate email format
      if (!email || !email.includes("@")) {
        setError("Hele, tohle nevypadá jako platný email");
        setIsLoading(false);
        return;
      }

      // Validate CZU domain
      if (!isValidWorkEmailDomain(email.trim())) {
        setError("Email musí končit na @pef.czu.cz nebo @studenti.czu.cz");
        setIsLoading(false);
        return;
      }

      // Use updateUser to add email identity to existing authenticated user
      // This sends a verification link to the email address
      // With enable_manual_linking = true, this will link the email identity
      // Note: This adds the email as a secondary identity, not changing the primary email

      // Construct the redirect URL with next parameter if available
      // Ensure URL ends with ? or & so Supabase can append token_hash
      const confirmUrl = new URL(`${window.location.origin}/auth/confirm-email-change`);
      if (next) {
        // Validate next parameter to prevent open redirects
        const validatedNext = validateRedirectUrl(next, window.location.origin);
        if (validatedNext) {
          confirmUrl.searchParams.set("next", validatedNext);
        }
      }

      // Ensure URL ends with ? or & for token_hash to be appended
      let redirectUrl = confirmUrl.toString();
      if (confirmUrl.search === "") {
        // No query parameters, add ? for token_hash
        redirectUrl += "?";
      } else {
        // Has query parameters, ensure it ends with & for token_hash
        if (!redirectUrl.endsWith("&")) {
          redirectUrl += "&";
        }
      }

      const { data: updateData, error: updateError } = await supabase.auth.updateUser(
        {
          email: email.trim(),
        },
        {
          emailRedirectTo: redirectUrl,
        },
      );

      if (updateError) {
        // If email already exists, that's actually fine - it means it might already be linked
        // or we need to handle it differently
        if (updateError.message?.includes("already registered")) {
          setError("Tento email už někdo používá. Zkus jiný, nebo se přihlas pomocí tohoto emailu.");
        } else {
          setError(updateError.message || "Nepodařilo se poslat kód, zkus to znovu");
        }
        setIsLoading(false);
        return;
      }

      // Update suggested_work_email in public.users table
      // This enables cross-device synchronization and persistence
      // The trigger will automatically set last_otp_sent_at
      const { data: userData, error: getUserError } = await supabase.auth.getUser();

      if (getUserError || !userData?.user?.id) {
        // Log error but don't block the flow - OTP was sent successfully
        console.error("Failed to get user for suggested_work_email update:", getUserError || "User ID is undefined");
      } else {
        const { error: userUpdateError } = await supabase
          .from("users")
          .update({ suggested_work_email: email.trim() })
          .eq("auth_user_id", userData.user.id);

        if (userUpdateError) {
          // Log error but don't block the flow - OTP was sent successfully
          console.error("Failed to update suggested_work_email:", userUpdateError);
        }
      }

      // Move to OTP verification step
      setStep("otp");
      savePersistedState({ step: "otp", email: email.trim() });
      onStepChange?.("otp");
      setIsLoading(false);
    } catch (err) {
      setError("Ouha, něco se pokazilo. Zkus to prosím znovu");
      setIsLoading(false);
    }
  };

  /**
   * Verifies the OTP code and links email identity to user
   * Uses type 'email_change' since we're updating the user's email via updateUser()
   * With enable_manual_linking = true, this will link the email identity
   * to the existing authenticated user account
   */
  const verifyOTP = useCallback(async () => {
    const trimmedOtp = otpCode.trim();

    // Track the OTP being submitted to prevent re-submission
    setLastSubmittedOtp(trimmedOtp);
    setError(null);
    setIsLoading(true);

    try {
      // Verify OTP code for email change/linking
      // Use type 'email_change' because we used updateUser() to initiate the flow
      // With enable_manual_linking = true, this will link the email identity
      // to the current authenticated user instead of creating a new user
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: trimmedOtp,
        type: "email_change",
      });

      if (verifyError) {
        setError(verifyError.message || "Hmm, kód nesedí. Zkus to znovu nebo si nech poslat nový");
        setIsLoading(false);
        // Keep lastSubmittedOtp set to prevent re-submission of the same code
        // The code remains in the input so user can see what they entered
        return;
      }

      // Refresh session to ensure identities are updated
      await supabase.auth.refreshSession();

      // Clear persisted state on success
      clearPersistedState();

      // Success - redirect to next parameter or default page
      // Validate next parameter to prevent open redirects
      const validatedNext = next ? validateRedirectUrl(next, window.location.origin) : null;
      const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError("Ouha, něco se pokazilo. Zkus to prosím znovu");
      setIsLoading(false);
      // Keep lastSubmittedOtp set to prevent re-submission of the same code
    }
  }, [email, otpCode, next, supabase, router]);

  /**
   * Handles form submission for OTP verification
   */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyOTP();
  };

  /**
   * Loads persisted state from sessionStorage after component mounts (client-side only)
   * This prevents hydration mismatches between server and client
   */
  useEffect(() => {
    const persisted = loadPersistedState();

    // Validate persisted state - if on OTP step but no email, reset to email step
    if (persisted.step === "otp" && (!persisted.email || !persisted.email.includes("@"))) {
      setStep("email");
      setEmail("");
      clearPersistedState();
      setIsHydrated(true);
      return;
    }

    // Restore persisted state if valid
    if (persisted.email && persisted.email.includes("@")) {
      setEmail(persisted.email);
    }
    if (persisted.step === "email" || persisted.step === "otp") {
      setStep(persisted.step);
    }

    setIsHydrated(true);
  }, []);

  /**
   * Persists email changes to sessionStorage
   * Only saves when we have a valid email address and after hydration
   */
  useEffect(() => {
    // Don't persist until after hydration to avoid hydration mismatches
    if (!isHydrated) return;

    if (email && email.includes("@")) {
      savePersistedState({ step, email });
    } else if (step === "otp" && !email) {
      // If on OTP step but no email, clear invalid state
      clearPersistedState();
    }
  }, [email, step, isHydrated]);

  /**
   * Auto-submits the form when OTP code reaches the expected length
   * This handles paste events and manual entry
   * Prevents re-submission of the same OTP code after a failed verification
   */
  useEffect(() => {
    const trimmedOtp = otpCode.trim();
    const isOtpComplete = trimmedOtp.length === OTP_LENGTH;
    const isNewOtp = trimmedOtp !== lastSubmittedOtp;

    if (step === "otp" && isOtpComplete && !isLoading && isNewOtp) {
      verifyOTP();
    }
  }, [otpCode, step, isLoading, lastSubmittedOtp, verifyOTP]);

  // In wizard mode, don't render Card wrapper (parent handles it)
  const content = (
    <>
      {!wizardMode && (
        <CardHeader>
          <CardTitle className="text-2xl">Ověř si email</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Připoj si k účtu svůj emailík pomocí ověřovacího kódu"
              : `Zadej kód, který ti přiletěl na ${email || "tvůj email"}`}
          </CardDescription>
        </CardHeader>
      )}
      <div className={wizardMode ? "" : "p-6"}>
        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Tvůj email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tvuj.email@pef.czu.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Email musí končit na @pef.czu.cz nebo @studenti.czu.cz
              </p>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Odesílám..." : "Poslat mi kód"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Ověřovací kód</Label>
              <Input
                id="otp"
                type="text"
                placeholder={`Zadej ${OTP_LENGTH}-místný kód`}
                value={otpCode}
                onChange={(e) => {
                  const newValue = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                  setOtpCode(newValue);
                  // Clear lastSubmittedOtp when user starts typing a new code
                  if (lastSubmittedOtp !== null && newValue !== lastSubmittedOtp) {
                    setLastSubmittedOtp(null);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
                  setOtpCode(pastedText);
                  // Clear lastSubmittedOtp when user pastes a new code
                  if (lastSubmittedOtp !== null && pastedText !== lastSubmittedOtp) {
                    setLastSubmittedOtp(null);
                  }
                }}
                disabled={isLoading}
                required
                autoFocus
                maxLength={OTP_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                Koukni do emailu, měl by tam být ověřovací kód
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Ověřuji..." : "Ověřit kód"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setOtpCode("");
                  setError(null);
                  setLastSubmittedOtp(null);
                  onStepChange?.("email");
                  savePersistedState({ step: "email", email });
                }}
                disabled={isLoading}
                className="w-full"
              >
                Změnit email
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );

  // Wrap in Card only if not in wizard mode
  return wizardMode ? content : <Card>{content}</Card>;
}
