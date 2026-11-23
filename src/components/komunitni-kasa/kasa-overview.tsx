"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, Landmark } from "lucide-react";
import { toast } from "sonner";

import { annotateTransactions, type AnnotatedTransaction } from "@/lib/komunitni-kasa/summary";
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { KasaLoadError } from "./kasa-load-error";
import { useCopy } from "./use-copy";
import { useKasaData } from "./use-kasa-data";

export const RB_TRANSPARENT_URL =
  "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036";

/** Kolik posledních pohybů ukázat na hlavní stránce. */
export const RECENT_MOVEMENTS_LIMIT = 5;

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

const SURFACE = "rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/60 sm:p-6";

function OverviewSkeleton() {
  return (
    <div className={cn(SURFACE, "space-y-6")} aria-busy="true" aria-label="Načítám data kasy">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-40 w-full" />
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

/** Aktuální zůstatek a poslední pohyby na transparentním účtu. */
export function KasaOverview() {
  const { state, reload } = useKasaData();
  const { copy, copied } = useCopy();

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const items = annotateTransactions(state.data.transactions);
    const net = items.reduce((sum, item) => sum + item.amount, 0);
    return { balance: state.data.account.balance ?? net, recent: items.slice(0, RECENT_MOVEMENTS_LIMIT) };
  }, [state]);

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error" || !derived) {
    return <KasaLoadError message={state.status === "error" ? state.message : "Načtení selhalo"} onRetry={reload} />;
  }

  const { account } = state.data;

  const handleCopy = async () => {
    if (await copy(account.number)) toast.success("Číslo účtu zkopírováno");
    else toast.error("Číslo účtu se nepodařilo zkopírovat");
  };

  return (
    <section aria-labelledby="stav-kasy" className="space-y-4 motion-safe:animate-rise" style={{ animationDelay: "120ms" }}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-3xl bg-hero p-6 text-hero-foreground sm:p-8">
        <div className="space-y-1">
          <h2 id="stav-kasy" className="flex items-center gap-2 text-sm font-medium text-hero-muted">
            <Landmark className="size-4" aria-hidden />
            Zůstatek na účtu
          </h2>
          <p className="font-heading text-5xl font-bold tracking-tight tabular-nums">{formatCzk(derived.balance)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
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

      <div className={cn(SURFACE, "space-y-2")}>
        <h3 className="font-heading text-base font-semibold">Poslední pohyby</h3>
        {derived.recent.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Zatím tu nejsou žádné pohyby</EmptyTitle>
              <EmptyDescription>Každá platba se tu objeví hned, jak ji banka zaúčtuje</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ul aria-label="Poslední pohyby" className="divide-y divide-border/60">
              {derived.recent.map((item) => (
                <MovementRow key={item.tx.idTransaction} item={item} />
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-2 w-full sm:w-auto">
              <Link href="/komunitni-kasa/pohyby">Zobrazit všechny pohyby</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
