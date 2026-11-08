"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";

interface RefreshSessionStepProps {
  next?: string;
}

/**
 * Shown when the account is fully set up but the session token predates the
 * email identity (e.g. verified on another device). A manual button — not an
 * auto-refresh — so a token that stays stale can never cause a redirect loop.
 */
export function RefreshSessionStep({ next }: RefreshSessionStepProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    const { error } = await createClient().auth.refreshSession();

    if (error) {
      toast.error("Nepodařilo se obnovit přihlášení. Zkus se odhlásit a přihlásit znovu.");
      setIsLoading(false);
      return;
    }

    const validatedNext = next ? validateRedirectUrl(next, window.location.origin) : null;
    router.replace(validatedNext ?? DEFAULT_LOGGED_IN_PAGE);
    router.refresh();
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <RefreshCw className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Účet je připravený</h1>
        <p className="text-sm text-muted-foreground">
          Email máš ověřený a profil propojený. Stačí obnovit přihlášení.
        </p>
      </div>
      <Button className="w-full" onClick={handleContinue} disabled={isLoading}>
        {isLoading ? "Obnovuji…" : "Pokračovat do Tappky"}
      </Button>
    </div>
  );
}
