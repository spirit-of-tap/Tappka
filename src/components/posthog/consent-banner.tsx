"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Cookie, X } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { recordConsentChoice, shouldAskConsent } from "@/lib/consent";

const emptySubscribe = () => () => {};

function needsChoice(): boolean {
  try {
    return shouldAskConsent(posthog.get_explicit_consent_status());
  } catch {
    // PostHog not initialised — stay hidden
    return false;
  }
}

export function ConsentBanner() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (!mounted || dismissed) return null;
  if (!needsChoice()) return null;

  const choose = (granted: boolean) => {
    try {
      if (granted) {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
    } catch {
      // ignore
    }
    recordConsentChoice();
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="consent-banner-title"
      aria-label="Souhlas s měřením používání"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border bg-card p-4 sm:p-5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Cookie className="size-5" />
          </span>
          <h2
            id="consent-banner-title"
            className="font-heading text-base font-semibold text-foreground tracking-tight"
          >
            Pomoz nám Tappku vylepšovat
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zavřít bez souhlasu"
          onClick={() => choose(false)}
          className="text-muted-foreground hover:text-foreground shrink-0 -mr-1 -mt-1"
        >
          <X className="size-4" />
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        S tvým souhlasem měříme, jak Tappku používáš, a když se ti něco rozbije,
        pomůže nám to chybu rychle najít a opravit. Data držíme v EU a škole
        je nepředáváme. Bez souhlasu neměříme nic.{" "}
        <Link
          href="/ochrana-soukromi"
          className="font-medium underline underline-offset-4 text-foreground hover:text-primary transition-colors inline-block"
        >
          Jak chráníme soukromí →
        </Link>
      </p>

      <p className="mt-2 text-xs text-muted-foreground/80 leading-normal">
        Plníme tím zákon o elektronických komunikacích (§ 89 odst. 3 ZEK) a
        nařízení GDPR. Souhlas je dobrovolný a kdykoli ho můžeš změnit nebo
        odvolat v Nastavení.
      </p>

      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full sm:w-auto min-w-24"
          onClick={() => choose(false)}
        >
          Odmítnout
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full sm:w-auto min-w-24"
          onClick={() => choose(true)}
        >
          Přijmout
        </Button>
      </div>
    </div>
  );
}
