import Link from "next/link";
import { Users, Wallet, type LucideIcon } from "lucide-react";

import {
  EXPENSE_KINDS,
  SMERNICE_DRAFT_LABEL,
  SMERNICE_IS_DRAFT,
  type ExpenseKind,
} from "@/lib/komunitni-kasa/smernice-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KasaSection } from "./kasa-section";

const KIND_ICONS: Record<ExpenseKind["id"], LucideIcon> = {
  provozni: Wallet,
  strategicke: Users,
};

export const SMERNICE_HREF = "/komunitni-kasa/dokumenty/smernice";

export function DraftBadge() {
  return (
    <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning-strong">
      {SMERNICE_DRAFT_LABEL}
    </Badge>
  );
}

/** Dvě věty o tom, kdo rozhoduje o výdajích (podle návrhu směrnice). */
export function DecisionExplainer() {
  return (
    <KasaSection
      id="jak-se-rozhoduje"
      title="Kdo rozhoduje o výdajích"
      aside={SMERNICE_IS_DRAFT ? <DraftBadge /> : null}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {EXPENSE_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind.id];
          return (
            <li key={kind.id} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-xs">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2-strong">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed">
                <span className="font-heading font-semibold">{kind.title}. </span>
                <span className="text-muted-foreground">{kind.plain}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <Button asChild variant="link" size="sm" className="h-auto px-0">
        <Link href={SMERNICE_HREF}>Celé znění směrnice</Link>
      </Button>
    </KasaSection>
  );
}
