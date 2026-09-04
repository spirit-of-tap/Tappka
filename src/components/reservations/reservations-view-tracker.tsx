"use client";

import { useEffect } from "react";

import { trackView } from "@/lib/analytics";

export function ReservationsViewTracker() {
  useEffect(() => {
    trackView("reservations");
  }, []);
  return null;
}
