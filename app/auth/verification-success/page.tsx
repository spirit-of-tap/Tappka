"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

/**
 * Formats duration in milliseconds to a human-readable string
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string like "2 minutes 15 seconds" or "45 seconds"
 */
function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ${hours % 24} hour${(hours % 24) !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes % 60} minute${(minutes % 60) !== 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds % 60} second${(seconds % 60) !== 1 ? "s" : ""}`;
  }
  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}

/**
 * Component that uses useSearchParams to display verification time
 * Must be wrapped in Suspense boundary
 */
function VerificationSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verificationTime, setVerificationTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startTimeParam = searchParams.get("start_time");
    const next = searchParams.get("next");

    if (!startTimeParam) {
      // No timestamp provided, redirect to default page
      router.push(next ?? DEFAULT_LOGGED_IN_PAGE);
      return;
    }

    const startTime = parseInt(startTimeParam, 10);
    if (isNaN(startTime) || startTime <= 0) {
      // Invalid timestamp, redirect to default page
      router.push(next ?? DEFAULT_LOGGED_IN_PAGE);
      return;
    }

    // Calculate verification duration
    const endTime = Date.now();
    const duration = endTime - startTime;
    const formattedDuration = formatDuration(duration);
    setVerificationTime(formattedDuration);
    setIsLoading(false);
  }, [searchParams, router]);

  const handleContinue = () => {
    const next = searchParams.get("next");
    router.push(next ?? DEFAULT_LOGGED_IN_PAGE);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Email Verified Successfully!</CardTitle>
          <CardDescription>
            Your email has been successfully verified and linked to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {verificationTime && (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Verification Time
              </p>
              <p className="text-2xl font-semibold">
                {verificationTime}
              </p>
            </div>
          )}
          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Email verification success page
 * Displays how long it took the user to verify their email
 */
export default function VerificationSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">Loading...</div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerificationSuccessContent />
    </Suspense>
  );
}
