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
import { cn } from "@/lib/utils";
import { isValidWorkEmailDomain, OTP_LENGTH, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

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

/**
 * Form component for email verification via OTP
 * Allows users to link an email identity to their Google OAuth account
 */
export function VerifyEmailForm() {
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
      // Validate email format
      if (!email || !email.includes("@")) {
        setError("Please enter a valid email address");
        setIsLoading(false);
        return;
      }

      // Validate CZU domain
      if (!isValidWorkEmailDomain(email.trim())) {
        setError("Email must end with @pef.czu.cz or @studenti.czu.cz");
        setIsLoading(false);
        return;
      }

      // Use updateUser to add email identity to existing authenticated user
      // This sends a verification link to the email address
      // With enable_manual_linking = true, this will link the email identity
      // Note: This adds the email as a secondary identity, not changing the primary email
      const { data: updateData, error: updateError } = await supabase.auth.updateUser(
        {
          email: email.trim(),
        },
      );

      if (updateError) {
        // If email already exists, that's actually fine - it means it might already be linked
        // or we need to handle it differently
        if (updateError.message?.includes("already registered")) {
          setError("This email is already registered. Please use a different email or sign in with that email.");
        } else {
          setError(updateError.message || "Failed to send OTP code");
        }
        setIsLoading(false);
        return;
      }

      // Move to OTP verification step
      setStep("otp");
      savePersistedState({ step: "otp", email: email.trim() });
      setIsLoading(false);
    } catch (err) {
      setError("An unexpected error occurred");
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
        setError(verifyError.message || "Invalid OTP code");
        setIsLoading(false);
        // Keep lastSubmittedOtp set to prevent re-submission of the same code
        // The code remains in the input so user can see what they entered
        return;
      }

      // Refresh session to ensure identities are updated
      await supabase.auth.refreshSession();

      // Clear persisted state on success
      clearPersistedState();

      // Success - redirect to protected page
      router.push(DEFAULT_LOGGED_IN_PAGE);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
      // Keep lastSubmittedOtp set to prevent re-submission of the same code
    }
  }, [email, otpCode, supabase, router]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Verify Email</CardTitle>
        <CardDescription>
          {step === "email"
            ? "Link an email address to your account using OTP verification"
            : `Enter the OTP code sent to ${email || "your email"}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@pef.czu.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Email must end with @pef.czu.cz or @studenti.czu.cz
              </p>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Sending..." : "Send OTP Code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder={`Enter ${OTP_LENGTH}-digit code`}
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
                Check your email for the verification code
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Verifying..." : "Verify Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setOtpCode("");
                  setError(null);
                  setLastSubmittedOtp(null);
                  savePersistedState({ step: "email", email });
                }}
                disabled={isLoading}
                className="w-full"
              >
                Change Email
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
