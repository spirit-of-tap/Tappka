import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, MailX } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  const error = params?.error || "";
  
  // Check if it's an expired/invalid link error
  const isExpiredLink = error.toLowerCase().includes("expired") || 
                        error.toLowerCase().includes("invalid");
  
  const Icon = isExpiredLink ? Clock : AlertCircle;
  const iconColor = isExpiredLink ? "text-primary" : "text-destructive";

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Icon */}
          <div className={`rounded-full bg-muted p-6 ${iconColor}`}>
            <Icon className="h-12 w-12" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-bold">
              {isExpiredLink ? "Ouha, odkaz vypršel!" : "Něco se pokazilo"}
            </h1>
            <p className="text-muted-foreground">
              {isExpiredLink 
                ? "Odkaz z emailu už není platný. Nech si poslat nový kód."
                : "Omlouváme se, ale něco nefunguje jak má."}
            </p>
          </div>

          {/* Error details */}
          {error && (
            <div className="w-full rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <MailX className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium">Technické detaily:</p>
                  <p className="text-xs text-muted-foreground font-mono wrap-break-word">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            {isExpiredLink ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/auth/onboarding">
                    Zkusit znovu
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/">
                    Zpět na hlavní stránku
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/">
                    Zpět na hlavní stránku
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/auth/login">
                    Přihlásit se
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh w-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítám...</div>
      </div>
    }>
      <ErrorContent searchParams={searchParams} />
    </Suspense>
  );
}
