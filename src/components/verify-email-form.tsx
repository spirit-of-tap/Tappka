"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ExternalLink } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn, validateRedirectUrl } from "@/lib/utils";
import { isValidWorkEmailDomain, OTP_LENGTH, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { hasLinkedProfile } from "@/lib/auth-helpers";

const STORAGE_KEY = "verify-email-form-state";
const EMAIL_DOMAIN_OPTIONS = ["@studenti.czu.cz", "@pef.czu.cz", "@rektorat.czu.cz"] as const;
const DEFAULT_EMAIL_DOMAIN = EMAIL_DOMAIN_OPTIONS[0];
const DEV_MAILPIT_URL = "http://127.0.0.1:54324";
const OTP_INPUT_SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);

type EmailDomainOption = (typeof EMAIL_DOMAIN_OPTIONS)[number];

/**
 * Extracts local part and selected domain from a full email
 */
const parseEmailParts = (value: string): { localPart: string; domain: EmailDomainOption } => {
  const trimmedValue = value.trim().toLowerCase();
  const matchedDomain = EMAIL_DOMAIN_OPTIONS.find((domain) => trimmedValue.endsWith(domain));

  if (!matchedDomain) {
    const [localPart = ""] = trimmedValue.split("@");
    return {
      localPart,
      domain: DEFAULT_EMAIL_DOMAIN,
    };
  }

  const localPart = trimmedValue.slice(0, -matchedDomain.length);

  return {
    localPart,
    domain: matchedDomain,
  };
};

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
  const isDevelopment = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState("");
  const [emailLocalPart, setEmailLocalPart] = useState("");
  const [emailDomain, setEmailDomain] = useState<EmailDomainOption>(DEFAULT_EMAIL_DOMAIN);
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
        setError("Použij prosím svůj ČZU email");
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
   * In wizard mode, always start fresh from email step
   */
  useEffect(() => {
    const trimmedLocalPart = emailLocalPart.trim().toLowerCase();
    if (!trimmedLocalPart) {
      setEmail("");
      return;
    }

    setEmail(`${trimmedLocalPart}${emailDomain}`);
  }, [emailLocalPart, emailDomain]);

  useEffect(() => {
    // In wizard mode, always start from email step (don't restore state)
    if (wizardMode) {
      setStep("email");
      setEmail("");
      setEmailLocalPart("");
      setEmailDomain(DEFAULT_EMAIL_DOMAIN);
      clearPersistedState();
      setIsHydrated(true);
      return;
    }

    const persisted = loadPersistedState();

    // Validate persisted state - if on OTP step but no email, reset to email step
    if (persisted.step === "otp" && (!persisted.email || !persisted.email.includes("@"))) {
      setStep("email");
      setEmail("");
      setEmailLocalPart("");
      setEmailDomain(DEFAULT_EMAIL_DOMAIN);
      clearPersistedState();
      setIsHydrated(true);
      return;
    }

    // Restore persisted state if valid
    if (persisted.email && persisted.email.includes("@")) {
      const { localPart, domain } = parseEmailParts(persisted.email);
      setEmailLocalPart(localPart);
      setEmailDomain(domain);
      setEmail(`${localPart}${domain}`);
    }
    if (persisted.step === "email" || persisted.step === "otp") {
      setStep(persisted.step);
    }

    setIsHydrated(true);
  }, [wizardMode]);

  /**
   * Persists email changes to sessionStorage
   * Only saves when we have a valid email address and after hydration
   */
  useEffect(() => {
    // Don't persist until after hydration to avoid hydration mismatches
    if (!isHydrated) return;

    if (emailLocalPart.trim()) {
      savePersistedState({ step, email });
    } else if (step === "otp" && !email) {
      // If on OTP step but no email, clear invalid state
      clearPersistedState();
    }
  }, [email, emailLocalPart, step, isHydrated]);

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

  /**
   * Supports pasting OTP from anywhere on the page while on OTP step
   * so users do not need to focus the input before pressing Cmd/Ctrl+V.
   */
  useEffect(() => {
    if (step !== "otp") {
      return;
    }

    const handleGlobalPaste = (event: ClipboardEvent) => {
      const pastedDigits = event.clipboardData?.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH) ?? "";
      if (pastedDigits.length !== OTP_LENGTH) {
        return;
      }

      event.preventDefault();
      setOtpCode(pastedDigits);
      setLastSubmittedOtp(null);
      setError(null);
    };

    document.addEventListener("paste", handleGlobalPaste);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
    };
  }, [step]);

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
        {isDevelopment && (
          <Button type="button" variant="outline" className="mb-4 w-full justify-between" asChild>
            <Link href={DEV_MAILPIT_URL} target="_blank" rel="noopener noreferrer">
              <span>Otevřít Mailpit</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}

        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-local-part">Tvůj ČZU email</Label>
              <div className="flex gap-2">
                <Input
                  id="email-local-part"
                  type="text"
                  placeholder="uis login"
                  value={emailLocalPart}
                  onChange={(e) => {
                    const inputValue = e.target.value.trim().toLowerCase();
                    if (!inputValue.includes("@")) {
                      setEmailLocalPart(inputValue);
                      return;
                    }

                    const { localPart, domain } = parseEmailParts(inputValue);
                    setEmailLocalPart(localPart);
                    setEmailDomain(domain);
                  }}
                  disabled={isLoading}
                  required
                  autoFocus
                />
                <Select
                  value={emailDomain}
                  onValueChange={(value) => setEmailDomain(value as EmailDomainOption)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Doména" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_DOMAIN_OPTIONS.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Použij svůj ČZU email
              </p>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Odesílám..." : "Poslat mi kód"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Ověřovací kód (volitelně)</Label>
              <div className="flex justify-center">
                <InputOTP
                  id="otp"
                  maxLength={OTP_LENGTH}
                  value={otpCode}
                  pattern={REGEXP_ONLY_DIGITS}
                  onChange={(value) => {
                    setOtpCode(value);
                    // Clear lastSubmittedOtp when user starts typing a new code
                    if (lastSubmittedOtp !== null && value !== lastSubmittedOtp) {
                      setLastSubmittedOtp(null);
                    }
                  }}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    {OTP_INPUT_SLOTS.map((index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Klikni na tlačítko v emailu nebo zadej kód výše. Koukni i do spamu.
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
