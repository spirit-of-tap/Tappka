"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, X, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRQuickReserveDialog } from "./qr-quick-reserve-dialog";
import { formatTime } from "@/lib/reservations/utils";

interface RoomQuickStatusProps {
  room: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  status: 'free' | 'occupied';
  currentReservation?: {
    title: string;
    occupantName: string;
    personCount: number | null;
    startTime: string;
    endTime: string;
    endsInMinutes: number;
    startsInMinutes?: number;
    isMyReservation?: boolean;
  };
  alternativeRooms?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  minutesUntilNextReservation?: number | null;
}

/**
 * QR Code Quick Status - Split screen with colored top half
 */
export function RoomQuickStatus({
  room,
  status,
  currentReservation,
  alternativeRooms = [],
  minutesUntilNextReservation,
}: RoomQuickStatusProps) {
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 45>(15);

  const handleQuickReserve = (duration: 15 | 30 | 45) => {
    setSelectedDuration(duration);
    setReserveDialogOpen(true);
  };

  const formatTimeUntilFree = () => {
    if (!currentReservation) return "";
    const minutes = currentReservation.endsInMinutes;

    if (minutes <= 0) return "právě teď";
    if (minutes <= 90) {
      return `za ${minutes} ${minutes === 1 ? 'minutu' : minutes < 5 ? 'minuty' : 'minut'}`;
    }
    return `v ${formatTime(currentReservation.endTime)}`;
  };

  const formatTimeUntilOccupied = () => {
    if (currentReservation?.startsInMinutes == null) return "";
    const minutes = currentReservation.startsInMinutes;
    return `za ${minutes} ${minutes === 1 ? 'minutu' : minutes < 5 ? 'minuty' : 'minut'}`;
  };

  // Distinguish between truly occupied (active reservation) and about-to-be-occupied (near-future)
  const isNearFutureOccupied = status === 'occupied' && currentReservation?.startsInMinutes != null;

  // Determine background color - using explicit hex values to avoid Tailwind purging dynamic class names
  let bgHex = "#16a34a"; // green-600
  if (status === 'occupied') {
    bgHex = isNearFutureOccupied ? "#d97706" : "#b31b1b"; // amber-600 for near-future, TAP red for active
  }

  return (
    <div className="fixed inset-0 text-white overflow-y-auto" style={{ backgroundColor: bgHex }}>
      {/* Close button - fixed top right */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 rounded-full"
          asChild
        >
          <Link href="/reservations">
            <X className="size-5" />
          </Link>
        </Button>
      </div>

      {/* Main content - centered and scrollable */}
      <div className="min-h-screen flex flex-col items-center justify-center p-6 py-20">
        <div className="w-full max-w-lg space-y-10">
          {/* Large icon */}
          <div className="flex justify-center">
            {status === 'occupied' && !isNearFutureOccupied && <XCircle className="size-32 drop-shadow-2xl" strokeWidth={1.5} />}
            {status === 'occupied' && isNearFutureOccupied && <Clock className="size-32 drop-shadow-2xl" strokeWidth={1.5} />}
            {status === 'free' && <CheckCircle2 className="size-32 drop-shadow-2xl" strokeWidth={1.5} />}
          </div>

          {/* Room name */}
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-heading font-bold tracking-tight">
              {room.name}
            </h1>
            {room.description && (
              <p className="text-base opacity-90 font-body">{room.description}</p>
            )}
          </div>

          {/* Status text and details */}
          <div className="space-y-8 text-center">
            {status === 'occupied' && currentReservation && (
              <>
                {isNearFutureOccupied ? (
                  /* Single precise statement — no separate heading + subtitle needed */
                  <p className="text-3xl font-heading font-bold tracking-tight">
                    Obsazuje se {formatTimeUntilOccupied()}
                  </p>
                ) : (
                  <p className="text-3xl font-heading font-bold tracking-tight">OBSAZENO</p>
                )}

                {/* Reservation details — timing is already in the heading/time range, no repeat */}
                <div className="space-y-4 bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                  <p className="text-xl font-heading font-semibold">{currentReservation.title}</p>
                  {currentReservation.isMyReservation && (
                    <Badge variant="secondary" className="bg-white/90 text-foreground font-heading font-semibold text-xs">
                      Moje rezervace
                    </Badge>
                  )}
                  <p className="text-sm opacity-90 font-body">
                    {currentReservation.occupantName}
                    {currentReservation.personCount && (
                      <span> • {currentReservation.personCount} {currentReservation.personCount === 1 ? 'osoba' : currentReservation.personCount < 5 ? 'osoby' : 'osob'}</span>
                    )}
                  </p>
                  <p className="text-sm opacity-90 flex items-center justify-center gap-2 font-body">
                    <Clock className="size-4" />
                    {formatTime(currentReservation.startTime)} - {formatTime(currentReservation.endTime)}
                  </p>
                  {/* Only show the "Volná za X" line for truly occupied rooms (when it ends matters) */}
                  {!isNearFutureOccupied && (
                    <p className="text-2xl font-heading font-semibold">
                      Volná {formatTimeUntilFree()}
                    </p>
                  )}
                </div>
              </>
            )}

            {status === 'free' && (
              <>
                <p className="text-3xl font-heading font-bold tracking-tight">VOLNÁ TEĎ</p>

                {/* How long until next reservation */}
                {minutesUntilNextReservation != null && (
                  <p className="text-base font-body opacity-90 -mt-4">
                    Volná ještě ~{minutesUntilNextReservation} min
                  </p>
                )}

                {/* Quick reserve buttons */}
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  {([15, 30, 45] as const).map((duration) => {
                    // Disable if the slot would overlap the next reservation.
                    // Subtract 15 min as a conservative buffer for roundToSlot rounding.
                    const available = minutesUntilNextReservation != null
                      ? minutesUntilNextReservation - 15
                      : Infinity;
                    const disabled = duration > available;
                    return (
                      <Button
                        key={duration}
                        size="lg"
                        variant="secondary"
                        disabled={disabled}
                        className="w-full text-base h-14 font-heading font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
                        onClick={() => handleQuickReserve(duration)}
                      >
                        {duration} minut
                      </Button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Alternative rooms - only show if occupied */}
          {status === 'occupied' && alternativeRooms.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-center">Volné alternativy</h3>

              <div className="space-y-2">
                {alternativeRooms.map((altRoom) => (
                  <Link
                    key={altRoom.id}
                    href={`/reservations/${altRoom.code}/quick`}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all active:scale-[0.98] shadow-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-sm truncate">{altRoom.name}</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs shrink-0 font-body">
                        Volná
                      </Badge>
                    </div>

                    <ArrowRight className="size-4 ml-2 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* View full schedule button */}
          <Button
            variant="secondary"
            size="lg"
            className="w-full h-12 text-sm font-heading font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-white/90 hover:bg-white text-foreground"
            asChild
          >
            <Link href={`/reservations/${room.code}`}>
              Zobrazit plný rozvrh
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick reserve dialog */}
      <QRQuickReserveDialog
        open={reserveDialogOpen}
        onOpenChange={setReserveDialogOpen}
        roomId={room.id}
        roomName={room.name}
        durationMinutes={selectedDuration}
      />
    </div>
  );
}
