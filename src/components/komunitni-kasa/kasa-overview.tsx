"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
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
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { KasaLoadError } from "./kasa-load-error";
import { KasaSection } from "./kasa-section";
import { useCopy } from "./use-copy";
import { useKasaData } from "./use-kasa-data";

export const RB_TRANSPARENT_URL =
  "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

/**
 * Věta o tomto měsíci. Vrácení nevyčerpaných příspěvků družstvům sem
 * nepatří — nejsou to výdaje kasy (najdeš je ve Všech pohybech).
 */
function monthSentence(summary: PeriodSummary): string {
  const parts: string[] = [];
  if (summary.income > 0) parts.push(`přišlo ${formatCzk(summary.income)}`);
  if (summary.spending > 0) parts.push(`utratilo se ${formatCzk(summary.spending)}`);
  if (parts.length === 0) return "Tento měsíc zatím bez pohybu";
  return `Tento měsíc ${parts.join(" a ")}`;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Načítám data kasy">
      <div className="space-y-3 border-t pt-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3 border-t pt-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function ExpenseRow({ item }: { item: AnnotatedTransaction }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 py-3 sm:grid-cols-[6.5rem_1fr_auto]">
      <time
        dateTime={item.date.toISOString()}
        className="hidden text-sm tabular-nums text-muted-foreground sm:block"
      >
        {dateFormatter.format(item.date)}
      </time>
      <div className="min-w-0">
        <p className="text-sm text-foreground">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          <span className="sm:hidden">{dateFormatter.format(item.date)}, </span>
          {TRANSACTION_CATEGORY_LABELS[item.category]}
        </p>
      </div>
      <p className="text-sm tabular-nums text-foreground">−{formatCzk(Math.abs(item.amount))}</p>
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
    };
  }, [state]);

  if (state.status === "loading") return <OverviewSkeleton />;
  if (state.status === "error" || !derived) {
    return (
      <div className="border-t pt-6">
        <KasaLoadError message={state.status === "error" ? state.message : "Načtení selhalo"} onRetry={reload} />
      </div>
    );
  }

  const { account } = state.data;
  const yearFigures = [
    { label: "Příjmy", value: derived.year.income },
    { label: "Výdaje", value: derived.year.spending },
  ];

  const handleCopy = async () => {
    if (await copy(account.number)) toast.success("Číslo účtu zkopírováno");
    else toast.error("Číslo účtu se nepodařilo zkopírovat");
  };

  return (
    <div className="space-y-10">
      <KasaSection
        id="stav-kasy"
        title="Stav kasy"
        aside={
          <Button asChild variant="ghost" size="sm" className="-mr-2 gap-1.5 text-muted-foreground">
            <a href={RB_TRANSPARENT_URL} target="_blank" rel="noopener noreferrer">
              Otevřít v bance <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        }
      >
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Zůstatek</p>
          <p className="font-heading text-4xl font-bold tracking-tight tabular-nums">{formatCzk(derived.balance)}</p>
          <p className="text-sm text-muted-foreground">{monthSentence(derived.month)}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Letos</h3>
          <ul aria-label="Letos" className="flex gap-10">
            {yearFigures.map((figure) => (
              <li key={figure.label} className="space-y-0.5">
                <span className="block text-sm text-muted-foreground">{figure.label}</span>
                <span className="block text-lg font-semibold tabular-nums">{formatCzk(figure.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          Transparentní účet u Raiffeisenbank
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-1.5 tabular-nums text-foreground"
            onClick={handleCopy}
            aria-label={`Zkopírovat číslo účtu ${account.number}`}
          >
            {account.number}
            {copied === account.number ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5 text-muted-foreground" aria-hidden />
            )}
          </Button>
        </p>
      </KasaSection>

      <KasaSection
        id="kam-jdou-penize"
        title="Kam jdou peníze"
        aside={
          <Button asChild variant="ghost" size="sm" className="-mr-2 text-muted-foreground">
            <Link href="/komunitni-kasa/pohyby">Zobrazit všechny pohyby</Link>
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
          <ul aria-label="Poslední výdaje" className="divide-y border-y">
            {derived.expenses.map((item) => (
              <ExpenseRow key={item.tx.idTransaction} item={item} />
            ))}
          </ul>
        )}
      </KasaSection>
    </div>
  );
}
