"use client";

import { useEffect, useRef } from "react";
import { Confetti, ConfettiRef } from "@/components/ui/confetti";

/**
 * Component that triggers confetti on first login
 * Uses localStorage to track if it's the user's first visit to dashboard
 */
export function FirstLoginConfetti() {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    // Check if this is first login
    const hasSeenDashboard = localStorage.getItem("hasSeenDashboard");
    
    if (!hasSeenDashboard) {
      // Mark as seen
      localStorage.setItem("hasSeenDashboard", "true");
      
      // Fire confetti after a short delay
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        // Fire again with different settings
        setTimeout(() => {
          confettiRef.current?.fire({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confettiRef.current?.fire({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);
      }, 500);
    }
  }, []);

  return (
    <Confetti
      ref={confettiRef}
      className="absolute left-0 top-0 z-50 size-full pointer-events-none"
      manualstart
    />
  );
}
