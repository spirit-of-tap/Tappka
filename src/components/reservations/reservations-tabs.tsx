"use client";

import { MyReservations } from "./my-reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface ReservationsTabsProps {
  myReservations: ReservationWithDetails[];
}

/**
 * Card wrapping the user's upcoming reservations
 */
export function ReservationsTabs({ myReservations }: ReservationsTabsProps) {
  return (
    <section
      className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm motion-safe:animate-rise md:p-6"
      style={{ animationDelay: "120ms" }}
    >
      <h2 className="mb-3 text-sm font-bold text-chart-3-strong">Moje rezervace</h2>
      <MyReservations reservations={myReservations} />
    </section>
  );
}
