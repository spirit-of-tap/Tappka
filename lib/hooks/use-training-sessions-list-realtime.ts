"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Sync with initialSessions when they change (e.g., server refresh)
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  /**
   * Fetch cross participants for a given session and update state.
   * Used on INSERT events since payload lacks joined profile data.
   */
  const fetchAndUpdateParticipants = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("training_session_cross_participants")
      .select("id, user_id, joined_at, user:profiles(id, name, picture)")
      .eq("training_session_id", sessionId);

    if (data) {
      const crossParticipants: CrossParticipant[] = data.map((p) => ({
        id: p.id as string,
        user_id: p.user_id as string,
        joined_at: p.joined_at as string,
        user: p.user as unknown as { id: string; name: string; picture: string | null } | undefined,
      }));

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, cross_participants: crossParticipants } : s
        )
      );
    }
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("training-sessions-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "training_session_cross_participants" },
        (payload) => {
          const newRow = payload.new as { training_session_id: string };
          fetchAndUpdateParticipants(newRow.training_session_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "training_session_cross_participants" },
        (payload) => {
          const deleted = payload.old as { id?: string; training_session_id?: string };

          if (deleted.training_session_id) {
            // Full row available — re-fetch to get accurate state
            fetchAndUpdateParticipants(deleted.training_session_id);
          } else if (deleted.id) {
            // Supabase Realtime only sends primary key on DELETE — filter by id across all sessions
            setSessions((prev) =>
              prev.map((s) => ({
                ...s,
                cross_participants: s.cross_participants?.filter((p) => p.id !== deleted.id),
              }))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "training_sessions" },
        (payload) => {
          const updated = payload.new as Partial<TrainingSessionWithDetails> & { id: string };
          setSessions((prev) =>
            prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
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
