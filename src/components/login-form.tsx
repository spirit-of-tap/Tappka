"use client";

import { cn } from "@/lib/utils";
import { GoogleLoginButton } from "@/components/google-login-button";

/**
 * Login form component using Google OAuth
 * Handles both new and existing users seamlessly
 */
export function LoginForm({
  className,
  next,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { next?: string }) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <GoogleLoginButton next={next} />
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
      </div>

      {/* Agreement info */}
      <p className="text-xs text-center text-muted-foreground">
        Přihlášením souhlasíš s použitím Google účtu pro přístup do Tappky.
        Při prvním přihlášení se účet vytvoří automaticky.
      </p>
    </div>
  );
}
