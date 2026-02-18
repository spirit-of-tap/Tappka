"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TrainingSessionWithDetails } from "@/lib/reservations/types";

interface UseTrainingSessionsListRealtimeOptions {
  initialSessions: TrainingSessionWithDetails[];
}

type CrossParticipant = NonNullable<TrainingSessionWithDetails["cross_participants"]>[number];

export function useTrainingSessionsListRealtime({
  initialSessions,
}: UseTrainingSessionsListRealtimeOptions) {
  const [sessions, setSessions] = useState<TrainingSessionWithDetails[]>(initialSessions);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Keep a ref to current sessions to avoid stale closure in realtime callbacks
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Sync with initialSessions when they change (e.g., server refresh)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  /**
   * Fetch cross participants for a given session and update state.
   * Used when realtime payload lacks joined profile data.
   */
  const fetchAndUpdateParticipants = useCallback(async (sessionId: string) => {
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
      // Transform data to match expected type structure
      const crossParticipants: CrossParticipant[] = data.map((p) => ({
        id: p.id as string,
        user_id: p.user_id as string,
        joined_at: p.joined_at as string,
        user: p.user as unknown as
          | { id: string; name: string; picture: string | null }
          | undefined,
      }));

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, cross_participants: crossParticipants }
            : s
        )
      );
    }
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("training-sessions-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "training_session_cross_participants",
        },
        (payload) => {
          console.log("[Realtime] INSERT payload.new:", payload.new);
          const newRow = payload.new as { training_session_id: string };
          // Re-fetch all participants for the affected session (payload lacks joined profile data)
          fetchAndUpdateParticipants(newRow.training_session_id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "training_session_cross_participants",
        },
        (payload) => {
          console.log("[Realtime] DELETE payload.old:", payload.old);
          const deleted = payload.old as { id?: string; training_session_id?: string };

          // With REPLICA IDENTITY FULL, we should get all columns
          if (deleted.training_session_id) {
            fetchAndUpdateParticipants(deleted.training_session_id);
          } else {
            // Fallback: re-fetch ALL sessions' participants
            // Use ref to get current sessions (avoid stale closure)
            console.warn("[Realtime] DELETE missing training_session_id, re-fetching all sessions");
            const currentSessions = sessionsRef.current;
            currentSessions.forEach(s => fetchAndUpdateParticipants(s.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "training_sessions",
        },
        (payload) => {
          const updated = payload.new as Partial<TrainingSessionWithDetails> & { id: string };
          // Merge updated fields into the matching session (preserves relations not in payload)
          setSessions((prev) =>
            prev.map((s) =>
              s.id === updated.id ? { ...s, ...updated } : s
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, fetchAndUpdateParticipants]);

  return { sessions };
}
