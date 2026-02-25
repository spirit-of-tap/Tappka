"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime, isReservationActive } from "@/lib/reservations/utils";
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface AvailableCoworksProps {
  coworks: ReservationWithDetails[];
}

const MAX_PARTICIPANTS = 3;

/**
 * List of open cowork sessions available to join (content only, no card wrapper)
 */
export function AvailableCoworks({ coworks }: AvailableCoworksProps) {
  const [hiddenCoworks, setHiddenCoworks] = useState<Set<string>>(new Set());
  
  const visibleCoworks = coworks.filter(c => !hiddenCoworks.has(c.id));
  
  if (visibleCoworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <UserPlus className="size-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          Žádné otevřené coworky
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleCoworks.map((cowork) => (
        <CoworkItem
          key={cowork.id}
          cowork={cowork}
          onJoinSuccess={(id) => setHiddenCoworks(prev => new Set(prev).add(id))}
        />
      ))}
    </div>
  );
}

interface CoworkItemProps {
  cowork: ReservationWithDetails;
  onJoinSuccess: (id: string) => void;
}

function CoworkItem({ cowork, onJoinSuccess }: CoworkItemProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  
  const isActive = isReservationActive(cowork);
  const startDate = new Date(cowork.start_time);
  const endDate = new Date(cowork.end_time);
  
  // Get participant count
  const participantCount = cowork.cowork_participants?.length || 0;
  
  // Owner name
  const ownerName = cowork.user?.name || cowork.team?.name || "Neznámý";

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const response = await fetch("/api/reservations/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservation_id: cowork.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se připojit");
      }

      // Refresh server state first, then hide — so a failed refresh leaves the item visible for retry
      await router.refresh();
      toast.success("Připojeno ke coworku");
      onJoinSuccess(cowork.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      {/* Top row: Date badge + Content */}
      <div className="flex gap-3 mb-3">
        {/* Date badge - always on left with month */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground uppercase">
            {startDate.toLocaleDateString("cs-CZ", { weekday: "short" })}
          </span>
          <span className="text-lg font-bold text-primary">
            {startDate.getDate()}.{startDate.getMonth() + 1}.
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="font-semibold text-base truncate mb-1">
            {cowork.title}
          </h4>
          
          {/* Room + Time in one line */}
          <p className="text-sm text-muted-foreground mb-1">
            {cowork.room?.code?.toUpperCase() || cowork.room?.name || "Místnost"} od {formatTime(startDate)} do {formatTime(endDate)}
          </p>
          
          {/* Owner */}
          <p className="text-xs text-muted-foreground mb-2">
            Vytvořil/a: {ownerName}
          </p>
          
          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5">
            {isActive && (
              <Badge variant="default" className="text-xs">
                Probíhá
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <Users className="size-3 mr-1" />
              {participantCount}/{MAX_PARTICIPANTS} účastníků
            </Badge>
            {cowork.person_count && (
              <Badge variant="secondary" className="text-xs">
                <Users className="size-3 mr-1" />
                {cowork.person_count} osob
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Join button spanning full width */}
      <div>
        <Button 
          variant="default" 
          size="sm"
          className="w-full"
          onClick={handleJoin}
          disabled={isJoining || participantCount >= MAX_PARTICIPANTS}
        >
          {isJoining ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Připojování...
            </>
          ) : participantCount >= MAX_PARTICIPANTS ? (
            "Plné"
          ) : (
            "Připojit se"
          )}
        </Button>
      </div>
    </div>
  );
}
