"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CrossParticipantActionsProps {
  sessionId: string;
  isJoined: boolean;
  availableSlots: number;
}

export function CrossParticipantActions({
  sessionId,
  isJoined,
  availableSlots,
}: CrossParticipantActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}/cross-participants`, {
        method: "POST",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se přihlásit");
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}/cross-participants`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se odhlásit");
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  if (isJoined) {
    return (
      <Button
        variant="secondary"
        onClick={handleLeave}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin mr-2" />
        ) : null}
        Odhlásit se z crossu
      </Button>
    );
  }

  if (availableSlots <= 0) {
    return (
      <Button variant="outline" disabled>
        Obsazeno
      </Button>
    );
  }

  return (
    <Button onClick={handleJoin} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin mr-2" />
      ) : (
        <UserPlus className="size-4 mr-2" />
      )}
      Crossnout
    </Button>
  );
}
