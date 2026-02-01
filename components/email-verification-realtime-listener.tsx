"use client";

import { useEmailVerificationRealtime } from "@/lib/hooks/use-email-verification-realtime";

/**
 * Client component that sets up Realtime subscription for email verification
 * Must be used in a client component context (not in server components)
 * 
 * This component listens for verified_work_email changes and automatically
 * refreshes the session and redirects when verification completes on any device
 */
export function EmailVerificationRealtimeListener() {
  useEmailVerificationRealtime();
  
  // This component doesn't render anything - it's just a side effect wrapper
  return null;
}
