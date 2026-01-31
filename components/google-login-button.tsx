"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

/**
 * Google OAuth login button component
 * Handles both sign-in and sign-up flows seamlessly
 */
export function GoogleLoginButton({ next }: { next?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
      if (next) {
        callbackUrl.searchParams.set("next", next);
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
      className="w-full"
      variant="outline"
    >
      {isLoading ? (
        "Connecting..."
      ) : (
        <>
          <svg
            className="mr-2 h-4 w-4"
            aria-hidden="true"
            focusable="false"
            data-prefix="fab"
            data-icon="google"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 488 512"
          >
            <path
              fill="currentColor"
              d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 52.6 94.3 256s164.2 203.4 254.5 203.4c56.5 0 86.9-31.7 98.1-72.5 10.7-38.6 4.1-66.1-3.5-88.3H248v-94.8h240z"
            ></path>
          </svg>
          Continue with Google
        </>
      )}
    </Button>
  );
}
