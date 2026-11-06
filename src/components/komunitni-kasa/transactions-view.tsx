"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { annotateTransactions, filterAnnotated } from "@/lib/komunitni-kasa/summary";
import type { TransactionFilter } from "@/lib/komunitni-kasa/stats";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KasaLoadError } from "./kasa-load-error";
import { TransactionsTable } from "./transactions-table";
import { useKasaData } from "./use-kasa-data";

const FILTER_OPTIONS: { value: TransactionFilter; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "income", label: "Příjmy" },
  { value: "expense", label: "Výdaje" },
];

const MOVEMENT_FORMS: [string, string, string] = ["pohyb", "pohyby", "pohybů"];

/** Všechny pohyby na transparentním účtu s hledáním a filtrem. */
export function TransactionsView() {
  const { state, reload } = useKasaData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");

  const items = useMemo(
    () => (state.status === "ready" ? annotateTransactions(state.data.transactions) : []),
    [state],
  );
  const visible = useMemo(() => filterAnnotated(items, query, filter), [items, query, filter]);

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Načítám pohyby">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === "error") return <KasaLoadError message={state.message} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledej podle popisu, kategorie nebo částky"
            className="pl-9"
            aria-label="Hledat v pohybech"
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={filter}
          onValueChange={(value) => value && setFilter(value as TransactionFilter)}
          aria-label="Směr platby"
        >
          {FILTER_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="px-3">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {visible.length} z {items.length} {pluralizeCz(items.length, MOVEMENT_FORMS)} · od nejnovějšího
      </p>
      <TransactionsTable items={visible} />
    </div>
  );
}
