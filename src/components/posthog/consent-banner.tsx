"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (posthog.get_explicit_consent_status() === "pending") {
        setVisible(true);
      }
    } catch {
      // PostHog not initialised — stay hidden
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try {
      posthog.opt_in_capturing();
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const decline = () => {
    try {
      posthog.opt_out_capturing();
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Souhlas s analytikou"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border bg-card p-4 shadow-lg"
    >
      <p className="text-sm">
        Pomozte nám zlepšit Tappku. Měříme anonymizované používání a chyby.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={accept}>
          Přijmout
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={decline}>
          Odmítnout
        </Button>
      </div>
    </div>
  );
}
