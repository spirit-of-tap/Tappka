import Link from "next/link";
import { ClipboardList, Receipt, Users, Vote, Wallet, type LucideIcon } from "lucide-react";

import {
  DECISION_CYCLE,
  EXPENSE_KINDS,
  OPERATIONAL_LIMIT_EXAMPLE,
  SMERNICE_DRAFT_LABEL,
  SMERNICE_DRAFT_NOTE,
  SMERNICE_IS_DRAFT,
  operationalLimit,
  type CycleStep,
  type ExpenseKind,
} from "@/lib/komunitni-kasa/smernice-data";
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KasaSection } from "./kasa-section";

const CYCLE_ICONS: Record<CycleStep["icon"], LucideIcon> = {
  users: Users,
  "clipboard-list": ClipboardList,
  vote: Vote,
  receipt: Receipt,
};

const KIND_ICONS: Record<ExpenseKind["id"], LucideIcon> = {
  provozni: Wallet,
  strategicke: Vote,
};

export const SMERNICE_HREF = "/komunitni-kasa/dokumenty/smernice";

export function DraftBadge() {
  return (
    <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning-strong">
      {SMERNICE_DRAFT_LABEL}
    </Badge>
  );
}

function limitExample(): string {
  const { members, contribution } = OPERATIONAL_LIMIT_EXAMPLE;
  return `Např. ${members} osob × ${formatCzk(contribution)} → limit ${formatCzk(operationalLimit(OPERATIONAL_LIMIT_EXAMPLE))} měsíčně`;
}

function KindBlock({ kind }: { kind: ExpenseKind }) {
  const Icon = KIND_ICONS[kind.id];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-primary" aria-hidden />
        <h3 className="font-heading text-base font-semibold">{kind.title}</h3>
      </div>
      <p className="text-sm font-medium">{kind.whoDecides}</p>
      <p className="text-sm text-muted-foreground">
        {kind.summary} Třeba {kind.examples.join(", ")}.
      </p>
      <p className="text-sm text-muted-foreground">{kind.rule}</p>
      {kind.id === "provozni" ? <p className="text-xs text-muted-foreground">{limitExample()}</p> : null}
    </div>
  );
}

/** Srozumitelné shrnutí směrnice o výdajích (zatím návrh). */
export function DecisionExplainer() {
  return (
    <KasaSection
      id="jak-se-rozhoduje"
      title="Jak se o penězích rozhoduje"
      aside={SMERNICE_IS_DRAFT ? <DraftBadge /> : null}
    >
      {SMERNICE_IS_DRAFT ? <p className="text-sm text-muted-foreground">{SMERNICE_DRAFT_NOTE}</p> : null}

      <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
        {EXPENSE_KINDS.map((kind) => (
          <KindBlock key={kind.id} kind={kind} />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-base font-semibold">Každý měsíc</h3>
        <ol className="grid gap-4 md:grid-cols-4">
          {DECISION_CYCLE.map((step, index) => {
            const Icon = CYCLE_ICONS[step.icon];
            return (
              <li key={step.title} className="flex gap-3 md:flex-col md:gap-1.5">
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-sm text-muted-foreground tabular-nums md:pt-0">
                  <Icon className="size-4" aria-hidden />
                  <span aria-hidden>{index + 1}.</span>
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <Button asChild variant="link" size="sm" className="h-auto px-0">
        <Link href={SMERNICE_HREF}>Celé znění směrnice</Link>
      </Button>
    </KasaSection>
  );
}
