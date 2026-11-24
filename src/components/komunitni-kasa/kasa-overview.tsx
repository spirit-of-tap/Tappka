"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Copy, ExternalLink, Landmark } from "lucide-react";
import { toast } from "sonner";

import {
  computeTrendWindow,
  computeYearTotals,
  groupByMonth,
  MEMBER_CONTRIBUTION_CZK,
  type DirectionTotal,
} from "@/lib/komunitni-kasa/overview";
import { annotateTransactions, type AnnotatedTransaction } from "@/lib/komunitni-kasa/summary";
import { computeBalanceTrend, formatCzk } from "@/lib/komunitni-kasa/stats";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroTrendChart } from "./hero-trend-chart";
import { KasaLoadError } from "./kasa-load-error";
import { useCopy } from "./use-copy";
import { useKasaData } from "./use-kasa-data";

export const RB_TRANSPARENT_URL =
  "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036";

/** Kolik posledních pohybů ukázat na hlavní stránce. */
export const RECENT_MOVEMENTS_LIMIT = 5;

const PAYMENT_FORMS: [string, string, string] = ["platba", "platby", "plateb"];

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

const CARD = "rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/60 sm:p-6";
const COLUMNS = "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start";

function OverviewSkeleton({ aside }: { aside: ReactNode }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Načítám data kasy">
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <div className={COLUMNS}>
        <Skeleton className="h-64 w-full rounded-2xl" />
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </div>
    </div>
  );
}

function MovementRow({ item }: { item: AnnotatedTransaction }) {
  const income = item.amount > 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          income ? "bg-success/15 text-success-strong" : "bg-muted text-muted-foreground",
        )}
      >
        {income ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
        <span className="sr-only">{income ? "Příchozí platba" : "Odchozí platba"}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.description}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{dateFormatter.format(item.date)}</p>
      </div>
      <p className={cn("shrink-0 self-start text-sm font-medium tabular-nums", income ? "text-success-strong" : "text-foreground")}>
        {income ? "+" : "−"}
        {formatCzk(Math.abs(item.amount))}
      </p>
    </li>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
}

function StatCard({ label, value, detail, valueClassName }: StatCardProps) {
  return (
    <div className={cn(CARD, "space-y-1 p-4 sm:p-5")}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("font-heading text-2xl font-bold tracking-tight tabular-nums", valueClassName)}>{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

const paymentCount = (total: DirectionTotal) => `${total.count} ${pluralizeCz(total.count, PAYMENT_FORMS)}`;

interface KasaOverviewProps {
  /** Postranní karty (rozhodování, kontakt, odkazy) vedle pohybů; na mobilu pod nimi. */
  aside?: ReactNode;
}

/** Zůstatek, vývoj, roční součty a poslední pohyby na transparentním účtu. */
export function KasaOverview({ aside }: KasaOverviewProps) {
  const { state, reload } = useKasaData();
  const { copy, copied } = useCopy();

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const now = new Date();
    const items = annotateTransactions(state.data.transactions);
    const net = items.reduce((sum, item) => sum + item.amount, 0);
    const trend = computeBalanceTrend(state.data.transactions, state.data.account.balance);
    return {
      balance: state.data.account.balance ?? net,
      year: now.getFullYear(),
      totals: computeYearTotals(items, now.getFullYear()),
      trendWindow: computeTrendWindow(trend, now),
      months: groupByMonth(items.slice(0, RECENT_MOVEMENTS_LIMIT)),
    };
  }, [state]);

  if (state.status === "loading") return <OverviewSkeleton aside={aside} />;
  if (state.status === "error" || !derived) {
    return (
      <div className={COLUMNS}>
        <KasaLoadError message={state.status === "error" ? state.message : "Načtení selhalo"} onRetry={reload} />
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </div>
    );
  }

  const { account } = state.data;
  const { trendWindow, totals, year } = derived;

  const handleCopy = async () => {
    if (await copy(account.number)) toast.success("Číslo účtu zkopírováno");
    else toast.error("Číslo účtu se nepodařilo zkopírovat");
  };

  return (
    <div className="space-y-6 motion-safe:animate-rise" style={{ animationDelay: "120ms" }}>
      <section
        aria-labelledby="stav-kasy"
        className={cn(
          "grid gap-8 rounded-3xl bg-hero p-6 text-hero-foreground sm:p-8",
          trendWindow && "lg:grid-cols-2 lg:items-end",
        )}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h2
              id="stav-kasy"
              className="flex items-center gap-2 text-xs font-medium tracking-wide text-hero-muted uppercase"
            >
              <Landmark className="size-4" aria-hidden />
              Zůstatek na účtu
            </h2>
            <p className="font-heading text-5xl font-bold tracking-tight tabular-nums">{formatCzk(derived.balance)}</p>
          </div>
          <div className="-ml-3 flex flex-wrap items-center gap-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="focus-ring-hero gap-1.5 tabular-nums text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground"
              onClick={handleCopy}
              aria-label={`Zkopírovat číslo účtu ${account.number}`}
            >
              {account.number}
              {copied === account.number ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5 text-hero-muted" aria-hidden />
              )}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="focus-ring-hero gap-1.5 text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground"
            >
              <a href={RB_TRANSPARENT_URL} target="_blank" rel="noopener noreferrer">
                Transparentní účet <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
        {trendWindow ? (
          <figure className="min-w-0 space-y-2">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-hero-muted">
              <span className="font-medium tracking-wide uppercase">Vývoj za 12 měsíců</span>
              <span>{trendWindow.periodLabel}</span>
            </figcaption>
            <HeroTrendChart data={trendWindow.points} />
            <p className="sr-only">{trendWindow.summary}</p>
          </figure>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Příjmy ${year}`}
          value={`+${formatCzk(totals.income.sum)}`}
          detail={paymentCount(totals.income)}
          valueClassName="text-success-strong"
        />
        <StatCard label={`Výdaje ${year}`} value={`−${formatCzk(totals.expense.sum)}`} detail={paymentCount(totals.expense)} />
        <StatCard label="Příspěvek" value={formatCzk(MEMBER_CONTRIBUTION_CZK)} detail="měsíčně na osobu" />
      </div>

      <div className={COLUMNS}>
        <section aria-labelledby="pohyby" className={cn(CARD, "min-w-0 space-y-3")}>
          <h2 id="pohyby" className="font-heading text-base font-semibold">
            Pohyby
          </h2>
          {derived.months.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Zatím tu nejsou žádné pohyby</EmptyTitle>
                <EmptyDescription>Každá platba se tu objeví hned, jak ji banka zaúčtuje</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ul aria-label="Poslední pohyby" className="space-y-3">
                {derived.months.map((month) => (
                  <li key={month.key}>
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{month.label}</h3>
                    <ul className="divide-y divide-border/60">
                      {month.items.map((item) => (
                        <MovementRow key={item.tx.idTransaction} item={item} />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <Button asChild variant="link" size="sm" className="h-auto px-0">
                <Link href="/komunitni-kasa/pohyby">
                  Zobrazit všechny pohyby <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </>
          )}
        </section>
        {aside ? <div className="min-w-0 space-y-4">{aside}</div> : null}
      </div>
    </div>
  );
}
