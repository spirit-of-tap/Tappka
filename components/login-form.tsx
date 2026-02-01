"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Přihlášení</CardTitle>
          <CardDescription>
            Přihlaste se pomocí svého Google účtu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <GoogleLoginButton next={next} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
