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
    setError(null);
    setIsLoading(true);

    try {
      // Verify OTP code for email change/linking
      // Use type 'email_change' because we used updateUser() to initiate the flow
      // With enable_manual_linking = true, this will link the email identity
      // to the current authenticated user instead of creating a new user
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "email_change",
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid OTP code");
        setIsLoading(false);
        return;
      }

      // Refresh session to ensure identities are updated
      await supabase.auth.refreshSession();

      // Success - redirect to protected page
      router.push("/protected");
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
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
   * Auto-submits the form when OTP code reaches 8 digits
   * This handles paste events and manual entry
   */
  useEffect(() => {
    if (step === "otp" && otpCode.length === 8 && !isLoading) {
      verifyOTP();
    }
  }, [otpCode, step, isLoading, verifyOTP]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Verify Email</CardTitle>
        <CardDescription>
          {step === "email"
            ? "Link an email address to your account using OTP verification"
            : "Enter the OTP code sent to your email"}
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
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You can use a different email than your Google account
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
                placeholder="Enter 8-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
                  setOtpCode(pastedText);
                }}
                disabled={isLoading}
                required
                autoFocus
                maxLength={8}
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
