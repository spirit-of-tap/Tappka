"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ShieldCheck } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

function getConsentStatus(): string {
  try {
    return posthog.get_explicit_consent_status();
  } catch {
    // PostHog not initialised — stay hidden
    return "granted";
  }
}

export function ConsentBanner() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!mounted || dismissed) return null;
  if (getConsentStatus() !== "pending") return null;

  const accept = () => {
    try {
      posthog.opt_in_capturing();
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const decline = () => {
    try {
      posthog.opt_out_capturing();
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Souhlas s měřením používání"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"
        >
          <ShieldCheck className="size-5 text-primary" />
        </span>
        <div>
          <p className="font-medium">Řekněte nám, co v Tappce funguje</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se souhlasem měříme, jak se používají rezervace a čtení, a
            zaznamenáváme chyby, abychom je uměli opravit. Nikdy je nepředáváme
            škole ke kontrole. Data držíme v EU. Bez souhlasu neměříme nic.{" "}
            <Link
              href="/ochrana-soukromi"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Jak chráníme soukromí
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={accept}>
          Přijmout
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={decline}>
          Odmítnout
        </Button>
      </div>
    </div>
  );
}
