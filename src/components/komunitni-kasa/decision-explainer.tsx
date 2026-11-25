import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  EXPENSE_KINDS,
  SMERNICE_DRAFT_LABEL,
  SMERNICE_IS_DRAFT,
  type ExpenseKind,
} from "@/lib/komunitni-kasa/smernice-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const SMERNICE_HREF = "/komunitni-kasa/dokumenty/smernice";

const STEP_TONES: Record<ExpenseKind["id"], string> = {
  provozni: "bg-success/15 text-success-strong",
  strategicke: "bg-warning/15 text-warning-strong",
};

export function DraftBadge() {
  return (
    <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning-strong">
      {SMERNICE_DRAFT_LABEL}
    </Badge>
  );
}

/** Kdo rozhoduje o výdajích (podle návrhu směrnice) — dva kroky podle velikosti výdaje. */
export function DecisionExplainer() {
  return (
    <section aria-labelledby="jak-se-rozhoduje" className="space-y-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/60">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="jak-se-rozhoduje" className="font-heading text-base font-semibold">
          Kdo rozhoduje o výdajích
        </h2>
        {SMERNICE_IS_DRAFT ? <DraftBadge /> : null}
      </div>
      <ol className="space-y-0">
        {EXPENSE_KINDS.map((kind, i) => (
          <li key={kind.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < EXPENSE_KINDS.length - 1 ? (
              <span aria-hidden className="absolute top-8 bottom-1 left-4 w-px -translate-x-1/2 bg-border" />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                STEP_TONES[kind.id],
              )}
            >
              {i + 1}
            </span>
            <p className="min-w-0 text-sm leading-relaxed">
              <span className="font-heading font-semibold">{kind.title}. </span>
              <span className="text-muted-foreground">{kind.plain}</span>
            </p>
          </li>
        ))}
      </ol>
      <Button asChild variant="link" size="sm" className="h-auto px-0">
        <Link href={SMERNICE_HREF}>
          Celé znění směrnice <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
