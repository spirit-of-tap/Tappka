"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MyReservations } from "./my-reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface ReservationsTabsProps {
  myReservations: ReservationWithDetails[];
}

/**
 * Handles responsive layout for the user's reservations list
 */
export function ReservationsTabs({ myReservations }: ReservationsTabsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Moje rezervace</CardTitle>
      </CardHeader>
      <CardContent>
        <MyReservations reservations={myReservations} />
      </CardContent>
    </Card>
  );
}
