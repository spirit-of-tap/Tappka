"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateRedirectUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

interface ConfirmClientProps {
  tokenHash: string;
  next?: string;
}

/**
 * Client component for email change confirmation.
 *
 * Renders a "Continue to Tappka" button that triggers the actual verifyOtp call.
 * This prevents email security scanners (like Microsoft SafeLinks / Defender)
 * from consuming the single-use OTP token by pre-fetching the link.
 *
 * The scanner will load this page (a harmless HTML render), but the token
 * is only consumed when the user clicks the button.
 */
export function ConfirmClient({ tokenHash, next }: ConfirmClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleConfirm = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: "email_change",
        token_hash: tokenHash,
      });

      if (verifyError) {
        setError(verifyError.message);
        setIsLoading(false);
        return;
      }

      // Refresh session to ensure identities are updated
      await supabase.auth.refreshSession();

      // Redirect to onboarding which handles the "already verified" case gracefully.
      // This avoids the issue where redirecting directly to the dashboard fails
      // because the profile link hasn't been established yet.
      const validatedNext = next
        ? validateRedirectUrl(next, window.location.origin)
        : null;

      const redirectUrl = new URL("/auth/onboarding", window.location.origin);
      if (validatedNext) {
        redirectUrl.searchParams.set("next", validatedNext);
      }

      router.push(redirectUrl.pathname + redirectUrl.search);
      router.refresh();
    } catch {
      setError("Něco se pokazilo. Zkus to prosím znovu.");
      setIsLoading(false);
    }
  };

  // Check if the error looks like an expired/invalid token
  const isExpiredError =
    error &&
    (error.toLowerCase().includes("expired") ||
      error.toLowerCase().includes("invalid"));

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Icon */}
          {error ? (
            <div className="rounded-full bg-muted p-6 text-destructive">
              <AlertCircle className="h-12 w-12" />
            </div>
          ) : (
            <div className="rounded-full bg-muted p-6 text-primary">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          )}

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-bold">
              {error ? "Něco se pokazilo" : "Email ověřen!"}
            </h1>
            <p className="text-muted-foreground">
              {error
                ? isExpiredError
                  ? "Odkaz z emailu už není platný. Nech si poslat nový kód."
                  : "Při ověřování emailu došlo k chybě."
                : "Klikni na tlačítko a pokračuj do Tappky."}
            </p>
          </div>

          {/* Error details */}
          {error && (
            <div className="w-full rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium">Technické detaily:</p>
                  <p className="text-xs text-muted-foreground font-mono break-words">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            {error ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/auth/onboarding">Zkusit znovu</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/auth/login">Zpět na přihlášení</Link>
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ověřuji...
                  </>
                ) : (
                  "Pokračovat do Tappky"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
