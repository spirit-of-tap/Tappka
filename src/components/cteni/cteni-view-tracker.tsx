"use client";

import { useEffect } from "react";

import { trackView } from "@/lib/analytics";

export function CteniViewTracker() {
  useEffect(() => {
    trackView("cteni");
  }, []);
  return null;
}
