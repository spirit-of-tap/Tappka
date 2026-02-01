"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

/**
 * Custom hook that listens for verified_work_email changes via Realtime
 * Enables cross-device synchronization when email verification completes
 * 
 * When verified_work_email changes on any device:
 * - Refreshes the auth session to get updated user data
 * - Redirects to the default logged-in page (or stays on current page if already there)
 * 
 * This allows users to:
 * - Request OTP on one device and verify on another (both devices get logged in)
 * - Request OTP on one device and log in on another (user returns to where they were)
 */
export function useEmailVerificationRealtime() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple subscriptions
    if (isSubscribedRef.current) {
      return;
    }

    let mounted = true;

    /**
     * Sets up Realtime subscription for email verification changes
     */
    const setupRealtimeSubscription = async () => {
      try {
        // Get current user to determine channel name
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          // User not authenticated, skip subscription
          return;
        }

        // Channel name format: user:{auth_user_id}:verification
        const channelName = `user:${user.id}:verification`;

        // Create channel with private configuration
        const channel = supabase.channel(channelName, {
          config: {
            broadcast: { self: true, ack: true },
            private: true,
          },
        });

        channelRef.current = channel;

        // Listen for verified_work_email_changed events
        channel.on(
          "broadcast",
          { event: "verified_work_email_changed" },
          async () => {
            if (!mounted) return;

            try {
              // Refresh session to get updated user data
              const { error: refreshError } = await supabase.auth.refreshSession();

              if (refreshError) {
                console.error("Failed to refresh session:", refreshError);
                return;
              }

              // Get current pathname to determine if we should redirect
              const currentPath = window.location.pathname;

              // If user is on verify-email page, redirect to default logged-in page
              // Otherwise, refresh the current page to show updated state
              if (currentPath === "/auth/verify-email") {
                router.push(DEFAULT_LOGGED_IN_PAGE);
              } else {
                // Refresh current page to show updated verification status
                router.refresh();
              }
            } catch (error) {
              console.error("Error handling verification change:", error);
            }
          }
        );

        // Set auth before subscribing (required for private channels)
        await supabase.realtime.setAuth();

        // Subscribe to channel
        channel.subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            isSubscribedRef.current = true;
          } else if (status === "CHANNEL_ERROR") {
            console.error("Channel subscription error:", err);
            isSubscribedRef.current = false;
          } else if (status === "CLOSED") {
            isSubscribedRef.current = false;
          }
        });
      } catch (error) {
        console.error("Error setting up Realtime subscription:", error);
      }
    };

    // Set up subscription
    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [router, supabase]);
}
