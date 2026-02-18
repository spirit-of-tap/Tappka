"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TrainingSessionWithDetails } from "@/lib/reservations/types";

interface UseTrainingSessionRealtimeOptions {
  /** The training session ID to subscribe to */
  sessionId: string;
  /** Initial session data from the server render */
  initialSession: TrainingSessionWithDetails;
}

interface UseTrainingSessionRealtimeReturn {
  session: TrainingSessionWithDetails;
}

export function useTrainingSessionRealtime({
  sessionId,
  initialSession,
}: UseTrainingSessionRealtimeOptions): UseTrainingSessionRealtimeReturn {
  const [session, setSession] =
    useState<TrainingSessionWithDetails>(initialSession);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Reset state when sessionId changes
    setSession(initialSession);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channelName = `training-session:${sessionId}`;

    /**
     * Re-fetch cross participants with profile data for a session.
     * Called on INSERT events because the realtime payload lacks joined profile data.
     */
    const fetchCrossParticipants = async () => {
      const { data } = await supabase
        .from("training_session_cross_participants")
        .select(
          `
          id,
          user_id,
          joined_at,
          user:profiles(id, name, picture)
        `
        )
        .eq("training_session_id", sessionId);

      if (data) {
        // Transform the data to match expected type structure
        // Supabase returns joined relations that we need to properly type
        const crossParticipants = data.map((p) => ({
          id: p.id as string,
          user_id: p.user_id as string,
          joined_at: p.joined_at as string,
          user: p.user as unknown as
            | { id: string; name: string; picture: string | null }
            | undefined,
        }));

        setSession((prev) => ({
          ...prev,
          cross_participants: crossParticipants,
        }));
      }
    };

    const channel = supabase
      .channel(channelName)
      // Cross participants changes
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "training_session_cross_participants",
          filter: `training_session_id=eq.${sessionId}`,
        },
        () => {
          // The payload only has the raw DB row (user_id, joined_at etc).
          // We don't have the joined user profile here, so we trigger a
          // lightweight re-fetch of just cross_participants for this session.
          fetchCrossParticipants();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "training_session_cross_participants",
          filter: `training_session_id=eq.${sessionId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            setSession((prev) => ({
              ...prev,
              cross_participants: prev.cross_participants?.filter(
                (p) => p.id !== deletedId
              ),
            }));
          } else {
            // Fallback: re-fetch if we can't identify the deleted row
            fetchCrossParticipants();
          }
        }
      )
      // Session updates (topic, cross_slots_available, times, etc.)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "training_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<TrainingSessionWithDetails>;
          setSession((prev) => ({ ...prev, ...updated }));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  return { session };
}
