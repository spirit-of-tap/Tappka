"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, X, Clock, Users, ArrowRight } from "lucide-react";
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
  status: 'free' | 'occupied' | 'locked';
  currentReservation?: {
    title: string;
    occupantName: string;
    personCount: number | null;
    startTime: string;
    endTime: string;
    endsInMinutes: number;
  };
  issues: {
    isLocked: boolean;
    otherIssues: string[];
  };
  alternativeRooms?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

/**
 * QR Code Quick Status - Split screen with colored top half
 */
export function RoomQuickStatus({ 
  room, 
  status, 
  currentReservation,
  issues,
  alternativeRooms = [],
}: RoomQuickStatusProps) {
  const router = useRouter();
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<30 | 60 | 120>(30);

  const handleQuickReserve = (duration: 30 | 60 | 120) => {
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

  // Determine background color
  let bgColor = "bg-green-600";
  let textColor = "text-white";
  if (status === 'locked') {
    bgColor = "bg-orange-500";
  } else if (status === 'occupied') {
    bgColor = "bg-red-600";
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Close button - fixed top right */}
      <div className="absolute top-4 right-4 z-50">
        <Button 
          variant="ghost" 
          size="icon"
          className={`${textColor} hover:bg-white/20 rounded-full`}
          asChild
        >
          <Link href="/dashboard/reservations">
            <X className="size-5" />
          </Link>
        </Button>
      </div>

      {/* TOP SECTION - Colored status area (70% of screen) */}
      <div className={`${bgColor} ${textColor} flex flex-col items-center justify-center p-8 pb-12`} style={{ minHeight: '70vh' }}>
        <div className="w-full max-w-lg space-y-8 text-center">
          {/* Large icon */}
          <div className="flex justify-center mb-4">
            {status === 'locked' && <AlertTriangle className="size-24" strokeWidth={1.5} />}
            {status === 'occupied' && <XCircle className="size-24" strokeWidth={1.5} />}
            {status === 'free' && <CheckCircle2 className="size-24" strokeWidth={1.5} />}
          </div>

          {/* Room name */}
          <div className="space-y-2">
            <h1 className="text-3xl font-heading font-bold tracking-tight">
              {room.name}
            </h1>
            {room.description && (
              <p className="text-base opacity-80">{room.description}</p>
            )}
          </div>

          {/* Status text */}
          <div className="space-y-6">
            {status === 'locked' && (
              <>
                <p className="text-2xl font-bold tracking-tight">ZAMČENÁ MÍSTNOST</p>
                <p className="text-sm opacity-80 max-w-xs mx-auto">
                  Někdo nahlásil, že se do místnosti nedá dostat
                </p>
              </>
            )}
            
            {status === 'occupied' && currentReservation && (
              <>
                <p className="text-2xl font-bold tracking-tight mb-4">OBSAZENO</p>
                
                {/* Reservation details */}
                <div className="space-y-3">
                  <p className="text-lg font-semibold">{currentReservation.title}</p>
                  <p className="text-sm opacity-80">
                    {currentReservation.occupantName}
                    {currentReservation.personCount && (
                      <span> • {currentReservation.personCount} {currentReservation.personCount === 1 ? 'osoba' : currentReservation.personCount < 5 ? 'osoby' : 'osob'}</span>
                    )}
                  </p>
                  <p className="text-sm opacity-80 flex items-center justify-center gap-2">
                    <Clock className="size-4" />
                    {formatTime(currentReservation.startTime)} - {formatTime(currentReservation.endTime)}
                  </p>
                  <p className="text-xl font-semibold mt-4">
                    Volná {formatTimeUntilFree()}
                  </p>
                </div>
              </>
            )}
            
            {status === 'free' && (
              <>
                <p className="text-2xl font-bold tracking-tight mb-6">VOLNÁ TEĎ</p>
                
                {/* Quick reserve buttons */}
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full text-base h-12 font-semibold"
                    onClick={() => handleQuickReserve(30)}
                  >
                    30 minut
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full text-base h-12 font-semibold"
                    onClick={() => handleQuickReserve(60)}
                  >
                    1 hodina
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full text-base h-12 font-semibold"
                    onClick={() => handleQuickReserve(120)}
                  >
                    2 hodiny
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION - Scrollable details area (30% and scrollable) */}
      <div className="bg-background flex-1 overflow-y-auto">
        <div className="w-full max-w-lg mx-auto p-6 space-y-4 pb-8">
          {/* Alternative rooms - only show if occupied */}
          {status === 'occupied' && alternativeRooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">Volné alternativy</h3>
              
              <div className="space-y-2">
                {alternativeRooms.map((altRoom) => (
                  <Link
                    key={altRoom.id}
                    href={`/dashboard/reservations/${altRoom.code}/qr`}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{altRoom.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {altRoom.code.toUpperCase()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 text-xs shrink-0">
                        Volná
                      </Badge>
                    </div>
                    
                    <ArrowRight className="size-4 text-muted-foreground ml-2 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Other issues warning */}
          {issues.otherIssues.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800">
              <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
                  Nahlášené problémy
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {issues.otherIssues.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* View full schedule button */}
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full h-12 text-sm font-semibold"
            asChild
          >
            <Link href={`/dashboard/reservations/${room.code}`}>
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
