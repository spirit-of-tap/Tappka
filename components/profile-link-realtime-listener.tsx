"use client";

import { useProfileLinkRealtime } from "@/lib/hooks/use-profile-link-realtime";

/**
 * Client component that sets up Realtime subscription for profile linking
 * Must be used in a client component context (not in server components)
 * 
 * This component listens for profile_linked changes and automatically
 * refreshes the session and redirects when admin approves/links the profile
 */
export function ProfileLinkRealtimeListener() {
  useProfileLinkRealtime();
  
  // This component doesn't render anything - it's just a side effect wrapper
  return null;
}
