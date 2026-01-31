"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { isValidWorkEmailDomain } from "@/lib/constants/auth";

interface UserState {
  suggested_work_email: string | null;
  last_otp_sent_at: string | null;
}

/**
 * Form component for email verification via OTP
 * Allows users to link an email identity to their Google OAuth account
 * State is managed in Supabase DB with Realtime sync
 */
export function VerifyEmailForm() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [userState, setUserState] = useState<UserState>({
    suggested_work_email: null,
    last_otp_sent_at: null,
  });
  const router = useRouter();
  const supabase = createClient();
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);

  /**
   * Determines the current step based on last_otp_sent_at timestamp
   * If timestamp doesn't exist or is older than 3600 seconds (1 hour), show email step
   * If timestamp is younger than 3600 seconds, show OTP step
   */
  const determineStep = useCallback((lastOtpSentAt: string | null): "email" | "otp" => {
    if (!lastOtpSentAt) {
      return "email";
    }

    const otpTimestamp = new Date(lastOtpSentAt).getTime();
    const now = Date.now();
    const secondsSinceOtp = (now - otpTimestamp) / 1000;

    // If OTP was sent less than 3600 seconds (1 hour) ago, show OTP step
    if (secondsSinceOtp < 3600) {
      return "otp";
    }

    // Otherwise, show email step
    return "email";
  }, []);

  /**
   * Loads user state from database and sets up Realtime subscription
   */
  const loadUserState = useCallback(async () => {
    setIsLoadingState(true);
    setError(null);

    try {
      // Get current authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setError("You must be logged in to verify your email");
        setIsLoadingState(false);
        return;
      }

      userIdRef.current = authUser.id;

      // Query public.users table to get id, suggested_work_email and last_otp_sent_at
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, suggested_work_email, last_otp_sent_at")
        .eq("auth_user_id", authUser.id)
        .single();

      if (userError) {
        // User might not exist in public.users yet (should be created by trigger)
        // Set default state and continue
        setUserState({
          suggested_work_email: null,
          last_otp_sent_at: null,
        });
        setStep("email");
        setIsLoadingState(false);
        return;
      }

      const newState: UserState = {
        suggested_work_email: userData?.suggested_work_email || null,
        last_otp_sent_at: userData?.last_otp_sent_at || null,
      };

      setUserState(newState);

      // Prefill email if suggested_work_email exists
      if (newState.suggested_work_email) {
        setEmail(newState.suggested_work_email);
      }

      // Determine step based on last_otp_sent_at
      const determinedStep = determineStep(newState.last_otp_sent_at);
      setStep(determinedStep);

      // Set up Realtime subscription for this user
      // Topic format: users:{public.users.id}
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      // Set auth before subscribing to private channel
      await supabase.realtime.setAuth();

      const channel = supabase
        .channel(`users:${userData.id}`, {
          config: {
            broadcast: { self: true },
            private: true,
          },
        })
        .on(
          "broadcast",
          { event: "UPDATE" },
          (payload: any) => {
            console.log("Realtime UPDATE received:", payload);
            // Update state when user record changes
            // realtime.broadcast_changes sends new and old records
            // Handle different payload structures
            const newRecord = payload.payload?.new || payload.new || payload.payload || payload;

            console.log("Extracted newRecord:", newRecord);

            if (newRecord && (newRecord.suggested_work_email !== undefined || newRecord.last_otp_sent_at !== undefined)) {
              console.log("Updating state from Realtime:", {
                suggested_work_email: newRecord.suggested_work_email,
                last_otp_sent_at: newRecord.last_otp_sent_at,
              });

              setUserState({
                suggested_work_email: newRecord.suggested_work_email || null,
                last_otp_sent_at: newRecord.last_otp_sent_at || null,
              });

              // Update step if needed
              const newStep = determineStep(newRecord.last_otp_sent_at);
              console.log("Determined step:", newStep, "from timestamp:", newRecord.last_otp_sent_at);
              setStep(newStep);

              // Update email if suggested_work_email changed
              if (newRecord.suggested_work_email) {
                setEmail(newRecord.suggested_work_email);
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Subscribed to user updates");
          } else if (status === "CHANNEL_ERROR") {
            console.error("Error subscribing to user updates");
          }
        });

      channelRef.current = channel;

      setIsLoadingState(false);
    } catch (err) {
      setError("Failed to load user state");
      setIsLoadingState(false);
    }
  }, [supabase, determineStep]);

  /**
   * Sends OTP code to the provided email
   * Updates suggested_work_email and last_otp_sent_at in database
   * Uses updateUser to add email identity to the current authenticated user
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

      if (!userIdRef.current) {
        setError("You must be logged in");
        setIsLoading(false);
        return;
      }

      const otpTimestamp = new Date().toISOString();

      // Update database with suggested_work_email and last_otp_sent_at
      const { error: updateDbError } = await supabase
        .from("users")
        .update({
          suggested_work_email: email.trim(),
          last_otp_sent_at: otpTimestamp,
        })
        .eq("auth_user_id", userIdRef.current);

      if (updateDbError) {
        setError("Failed to update user state");
        setIsLoading(false);
        return;
      }

      // Immediately update local state (fallback if Realtime doesn't fire)
      setUserState({
        suggested_work_email: email.trim(),
        last_otp_sent_at: otpTimestamp,
      });
      setStep("otp");

      // Use updateUser to add email identity to existing authenticated user
      // This sends a verification link to the email address
      // With enable_manual_linking = true, this will link the email identity
      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
      });

      if (updateError) {
        if (updateError.message?.includes("already registered")) {
          setError("This email is already registered. Please use a different email or sign in with that email.");
        } else {
          setError(updateError.message || "Failed to send OTP code");
        }
        setIsLoading(false);
        return;
      }

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

      // Clear OTP timestamp on success (reset to email step for next time)
      if (userIdRef.current) {
        await supabase
          .from("users")
          .update({
            last_otp_sent_at: null,
          })
          .eq("auth_user_id", userIdRef.current);
      }

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
   * Loads user state from database on mount
   */
  useEffect(() => {
    loadUserState();

    // Cleanup Realtime subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadUserState, supabase]);

  /**
   * Auto-submits the form when OTP code reaches 8 digits
   * This handles paste events and manual entry
   */
  useEffect(() => {
    if (step === "otp" && otpCode.length === 8 && !isLoading) {
      verifyOTP();
    }
  }, [otpCode, step, isLoading, verifyOTP]);

  if (isLoadingState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Verify Email</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">Loading user state...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                onClick={async () => {
                  setStep("email");
                  setOtpCode("");
                  setError(null);

                  // Clear OTP timestamp to reset to email step
                  if (userIdRef.current) {
                    await supabase
                      .from("users")
                      .update({
                        last_otp_sent_at: null,
                      })
                      .eq("auth_user_id", userIdRef.current);
                  }
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
