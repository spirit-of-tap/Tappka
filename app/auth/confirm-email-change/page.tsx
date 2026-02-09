import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConfirmClient } from "./confirm-client";

interface ConfirmEmailChangePageProps {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}

/**
 * Intermediate confirmation page for email change verification.
 *
 * Instead of verifying the OTP token immediately on GET (which gets consumed
 * by email security scanners like Microsoft SafeLinks), this page renders a
 * client component with a "Continue" button. The actual verifyOtp call only
 * happens when the user clicks the button.
 *
 * This prevents email link pre-fetching from consuming the single-use token.
 */
async function ConfirmContent({
  searchParams,
}: ConfirmEmailChangePageProps) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const type = params.type;
  const next = params.next;

  // Validate required parameters
  if (type !== "email_change") {
    redirect(`/auth/error?error=${encodeURIComponent("Invalid type")}`);
  }

  if (!tokenHash) {
    redirect(`/auth/error?error=${encodeURIComponent("Invalid token hash")}`);
  }

  return <ConfirmClient tokenHash={tokenHash} next={next} />;
}

export default function Page({
  searchParams,
}: ConfirmEmailChangePageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Načítám...
          </div>
        </div>
      }
    >
      <ConfirmContent searchParams={searchParams} />
    </Suspense>
  );
}
