"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { validateRedirectUrl } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * Google OAuth login button component
 * Handles both sign-in and sign-up flows seamlessly
 * Validates next parameter to prevent open redirects
 */
export function GoogleLoginButton({ next }: { next?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
      if (next) {
        // Validate next parameter to prevent open redirects (defense-in-depth)
        const validatedNext = validateRedirectUrl(next, window.location.origin);
        if (validatedNext) {
          // Properly encode the next parameter - it may contain query parameters itself
          callbackUrl.searchParams.set("next", validatedNext);
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error("Google OAuth error:", error);
        setIsLoading(false);
      }
      // Note: User will be redirected to Google, so we don't reset loading state here
    } catch (error) {
      console.error("Unexpected error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleGoogleLogin}
      disabled={isLoading}
      className="w-full font-medium"
      variant="outline"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Připojování...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.013-1.133 8.027-3.24 2.053-2.053 2.627-4.96 2.627-7.24 0-.52-.053-1.04-.16-1.6H12.48z"
            />
          </svg>
          Přihlásit se přes Google
        </>
      )}
    </Button>
  );
}
