"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  annotateTransactions,
  monthRange,
  recentExpenses,
  RECENT_EXPENSES_LIMIT,
  summarizePeriod,
  TRANSACTION_CATEGORY_LABELS,
  yearRange,
  type AnnotatedTransaction,
  type PeriodSummary,
} from "@/lib/komunitni-kasa/summary";
import { computeBalanceTrend, formatCzk } from "@/lib/komunitni-kasa/stats";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceTrendChart } from "./balance-trend-chart";
import { KasaLoadError } from "./kasa-load-error";
import { KasaSection } from "./kasa-section";
import { useCopy } from "./use-copy";
import { useKasaData } from "./use-kasa-data";

export const RB_TRANSPARENT_URL =
  "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

function monthLine(summary: PeriodSummary): string {
  const parts: string[] = [];
  if (summary.income > 0) parts.push(`příjmy +${formatCzk(summary.income)}`);
  if (summary.spending > 0) parts.push(`výdaje −${formatCzk(summary.spending)}`);
  if (summary.refunds > 0) parts.push(`vráceno družstvům ${formatCzk(summary.refunds)}`);
  if (parts.length === 0) return "Tento měsíc zatím bez pohybu";
  return `Tento měsíc: ${parts.join(" · ")}`;
}

function yearLine(summary: PeriodSummary): string {
  if (summary.count === 0) return "Letos zatím bez pohybu";
  const parts = [`příjmy ${formatCzk(summary.income)}`, `výdaje ${formatCzk(summary.spending)}`];
  if (summary.refunds > 0) parts.push(`vráceno družstvům ${formatCzk(summary.refunds)}`);
  return `Letos: ${parts.join(" · ")}`;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Načítám data kasy">
      <div className="space-y-3 border-t pt-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-3 border-t pt-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function ExpenseRow({ item }: { item: AnnotatedTransaction }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={item.date.toISOString()}>{dateFormatter.format(item.date)}</time>
          <span aria-hidden> · </span>
          {TRANSACTION_CATEGORY_LABELS[item.category]}
        </p>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
        −{formatCzk(Math.abs(item.amount))}
      </p>
    </li>
  );
}

/** Stav kasy a poslední výdaje z transparentního účtu. */
export function KasaOverview() {
  const { state, reload } = useKasaData();
  const { copy, copied } = useCopy();

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const items = annotateTransactions(state.data.transactions);
    const now = new Date();
    const month = monthRange(now);
    const year = yearRange(now);
    const net = items.reduce((sum, item) => sum + item.amount, 0);
    return {
      balance: state.data.account.balance ?? net,
      month: summarizePeriod(items, month.from, month.to),
      year: summarizePeriod(items, year.from, year.to),
      expenses: recentExpenses(items, RECENT_EXPENSES_LIMIT),
      trend: computeBalanceTrend(state.data.transactions, state.data.account.balance),
    };
  }, [state]);

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error" || !derived) {
    return (
      <div className="border-t pt-8">
        <KasaLoadError message={state.status === "error" ? state.message : "Načtení selhalo"} onRetry={reload} />
      </div>
    );
  }

  const { account } = state.data;

  const handleCopy = async () => {
    const ok = await copy(account.number);
    if (ok) toast.success("Číslo účtu zkopírováno");
    else toast.error("Číslo účtu se nepodařilo zkopírovat");
  };

  return (
    <div className="space-y-12">
      <KasaSection id="stav-kasy" title="Stav kasy">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-end">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Na účtu je teď</p>
              <p className="font-heading text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                {formatCzk(derived.balance)}
              </p>
            </div>
            <p className="text-sm text-foreground">{monthLine(derived.month)}</p>
            <p className="text-sm text-muted-foreground">{yearLine(derived.year)}</p>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-1 text-sm text-muted-foreground">
              <span>Transparentní účet</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 font-mono"
                onClick={handleCopy}
                aria-label={`Zkopírovat číslo účtu ${account.number}`}
              >
                {account.number}
                {copied === account.number ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </Button>
              <Button asChild variant="link" size="sm" className="h-8 gap-1 px-2">
                <a href={RB_TRANSPARENT_URL} target="_blank" rel="noopener noreferrer">
                  Otevřít v bance <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
            </div>
          </div>
          <figure className="space-y-2">
            <BalanceTrendChart data={derived.trend} />
            <figcaption className="text-xs text-muted-foreground">Vývoj zůstatku od založení účtu</figcaption>
          </figure>
        </div>
      </KasaSection>

      <KasaSection
        id="kam-jdou-penize"
        title="Kam jdou peníze"
        aside={
          <Button asChild variant="link" size="sm" className="h-auto gap-1 px-0">
            <Link href="/komunitni-kasa/pohyby">
              Zobrazit všechny pohyby <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      >
        {derived.expenses.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Zatím tu nejsou žádné výdaje</EmptyTitle>
              <EmptyDescription>Každý výdaj z kasy se tu objeví hned, jak ho banka zaúčtuje</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Poslední výdaje z účtu. Vrácení nevyčerpaných příspěvků družstvům sem nepočítáme.
            </p>
            <ul aria-label="Poslední výdaje" className="divide-y border-y">
              {derived.expenses.map((item) => (
                <ExpenseRow key={item.tx.idTransaction} item={item} />
              ))}
            </ul>
          </>
        )}
      </KasaSection>
    </div>
  );
}
