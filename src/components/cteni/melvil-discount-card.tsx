'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { isMelvilDiscountLive } from '@/lib/books/melvil-discount';
import { MELVIL_DISCOUNT } from '@/lib/constants/cteni';
import { copyTextToClipboard } from '@/lib/utils/clipboard';

const COPIED_FEEDBACK_MS = 2_000;

/** Partner discount card at the top of Objevovat; renders nothing before launch. */
export function MelvilDiscountCard() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    try {
      await copyTextToClipboard(MELVIL_DISCOUNT.code);
      setCopied(true);
    } catch {
      toast.error('Kód se nepodařilo zkopírovat');
    }
  }

  if (!isMelvilDiscountLive(new Date())) return null;

  return (
    <section
      aria-labelledby="melvil-discount-title"
      className="relative rounded-xl border border-primary/20 bg-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      >
        <div className="absolute -left-20 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative grid sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Image
              src="/partners/melvil-logo.png"
              alt="Jan Melvil Publishing"
              width={480}
              height={187}
              className="h-auto w-24 shrink-0 dark:brightness-0 dark:invert sm:w-28"
            />
            <span className="h-6 w-px bg-border" aria-hidden="true" />
            <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Partnerská sleva
            </span>
          </div>

          <div className="space-y-2">
            <h2 id="melvil-discount-title" className="font-heading font-bold">
              <span className="block text-5xl leading-none tracking-tight text-primary sm:text-6xl">
                {MELVIL_DISCOUNT.percent} %
              </span>{' '}
              <span className="mt-1 block text-lg sm:text-xl">na knihy od Melvilu</span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Skoro třetina knih, které u nás čteš, je právě z tohoto nakladatelství. Slevu
              uplatníš v košíku.
            </p>
          </div>
        </div>

        <div className="relative flex flex-col justify-center gap-3 border-t border-dashed border-primary/30 bg-primary/5 p-5 rounded-b-xl sm:w-64 sm:rounded-none sm:rounded-r-xl sm:border-t-0 sm:border-l sm:p-6">
          {/* Ticket notches where the perforation meets the card edge. */}
          <span
            aria-hidden="true"
            className="absolute -left-px -top-px size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-background [clip-path:inset(0_0_0_50%)] sm:[clip-path:inset(50%_0_0_0)]"
          />
          <span
            aria-hidden="true"
            className="absolute -right-px -top-px size-5 translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-background [clip-path:inset(0_50%_0_0)] sm:hidden"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px -left-px hidden size-5 -translate-x-1/2 translate-y-1/2 rounded-full border border-primary/20 bg-background [clip-path:inset(0_0_50%_0)] sm:block"
          />

          <span className="text-xs font-medium text-muted-foreground">Slevový kód</span>
          <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-background py-1.5 pl-3 pr-1.5">
            <code className="font-mono text-lg font-semibold tracking-[0.2em]">
              {MELVIL_DISCOUNT.code}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void copyCode()}
              aria-label={copied ? 'Kód zkopírován' : 'Kopírovat kód'}
              title={copied ? 'Zkopírováno' : 'Kopírovat kód'}
              className="text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <Check className="size-4 text-success-strong" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          <Button asChild className="w-full">
            <a href={MELVIL_DISCOUNT.url} target="_blank" rel="noopener noreferrer">
              Nakupovat na melvil.cz
              <ArrowUpRight className="size-4" aria-hidden="true" />
              <span className="sr-only">(otevře se v nové záložce)</span>
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
