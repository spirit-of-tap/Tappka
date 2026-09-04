"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { recordConsentChoice } from "@/lib/consent";

const emptySubscribe = () => () => {};

function currentStatus(): string {
  try {
    return posthog.get_explicit_consent_status();
  } catch {
    return "pending";
  }
}

/**
 * Self-service consent toggle: withdrawing is one click, re-granting too.
 * Mounted in Nastavení → Notifikace so consent never requires support.
 */
export function ConsentSettings() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [status, setStatus] = useState<string | null>(null);

  if (!mounted) return null;
  const effective = status ?? currentStatus();
  const granted = effective === "granted";

  const choose = (next: boolean) => {
    try {
      if (next) {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
    } catch {
      // ignore
    }
    recordConsentChoice();
    setStatus(next ? "granted" : "denied");
  };

  return (
    <section aria-label="Měření používání" className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          Měření používání
        </h2>
        <p className="text-sm text-muted-foreground">
          {granted
            ? "Měření je zapnuté: vidíme, jak Tappku používáš, a když se něco rozbije, abychom to mohli opravit. Škole se nic nepředává."
            : "Měření je vypnuté: nic se neměří."}{" "}
          <Link
            href="/ochrana-soukromi"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Jak chráníme soukromí
          </Link>
        </p>
      </div>
      {granted ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => choose(false)}
        >
          Odvolat souhlas s měřením
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => choose(true)}
        >
          Zapnout měření používání
        </Button>
      )}
    </section>
  );
}
