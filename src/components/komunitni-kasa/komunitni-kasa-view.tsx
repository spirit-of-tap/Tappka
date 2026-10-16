"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Landmark,
  RefreshCw,
  ScrollText,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import type { KasaResponse } from "@/lib/komunitni-kasa/types";
import {
  computeBalanceTrend,
  computeMonthlyCashflow,
  computeTotals,
  filterTransactions,
  formatCzk,
  type TransactionFilter,
} from "@/lib/komunitni-kasa/stats";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceTrendChart } from "./balance-trend-chart";
import { CashflowChart } from "./cashflow-chart";
import { TransactionsTable } from "./transactions-table";

const RB_TRANSPARENT_URL =
  "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: KasaResponse };

export function KomunitniKasaView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const reload = () => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  };

  const handleCopyAccount = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      toast.success("Číslo účtu zkopírováno do schránky");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Číslo účtu se nepodařilo zkopírovat");
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/komunitni-kasa")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Načtení selhalo");
        return (await res.json()) as KasaResponse;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Načtení selhalo",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const totals = useMemo(
    () => (state.status === "ready" ? computeTotals(state.data.transactions) : null),
    [state],
  );
  const monthly = useMemo(
    () => (state.status === "ready" ? computeMonthlyCashflow(state.data.transactions) : []),
    [state],
  );
  const trend = useMemo(
    () =>
      state.status === "ready"
        ? computeBalanceTrend(state.data.transactions, state.data.account.balance)
        : [],
    [state],
  );
  const visible = useMemo(
    () => (state.status === "ready" ? filterTransactions(state.data.transactions, query, filter) : []),
    [state, query, filter],
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a
          href={RB_TRANSPARENT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="size-4" aria-hidden />
          <span>Otevřít v bance</span>
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href="/komunitni-kasa/stanovy">
          <ScrollText className="size-4" aria-hidden />
          <span>Stanovy a rejstřík</span>
        </Link>
      </Button>
    </div>
  );

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Komunitní kasa"
          description="Sleduj příjmy, výdaje a zůstatek komunitní kasy"
          action={headerActions}
        />
        <div className="space-y-6" aria-busy="true" aria-label="Načítám data kasy">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Komunitní kasa"
          description="Sleduj příjmy, výdaje a zůstatek komunitní kasy"
          action={headerActions}
        />
        <Alert variant="destructive">
          <AlertTitle>Data se nepodařilo načíst</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{state.message}. Zkus to prosím znovu.</p>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="size-4" aria-hidden /> Načíst znovu
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { account, transactions } = state.data;

  if (transactions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Komunitní kasa"
          description="Sleduj příjmy, výdaje a zůstatek komunitní kasy"
          action={headerActions}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Zatím tu nejsou žádné transakce</EmptyTitle>
            <EmptyDescription>Transparentní účet zatím neeviduje žádný pohyb</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const balance = account.balance ?? totals?.net ?? 0;
  const cleanAccountName = account.name.replace(/\s+,/g, ",").trim();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Shared Page Header */}
      <PageHeader
        title="Komunitní kasa"
        description="Sleduj příjmy, výdaje a zůstatek komunitní kasy"
        count={{
          value: transactions.length,
          label: pluralizeCz(transactions.length, [
            "transakce",
            "transakce",
            "transakcí",
          ]),
        }}
        action={headerActions}
      />

      {/* Treasury balance & account info strip */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aktuální zůstatek
            </span>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-border/60">
              Transparentní účet
            </Badge>
          </div>
          <p className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl tabular-nums">
            {formatCzk(balance)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-y-1">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Landmark className="size-3.5 text-muted-foreground" aria-hidden />
            <span>{cleanAccountName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyAccount(account.number)}
              className="group inline-flex items-center gap-1 font-mono transition-colors hover:text-foreground cursor-pointer focus-ring rounded-xs"
              title="Kliknutím zkopíruješ číslo účtu"
              aria-label={`Zkopírovat číslo účtu ${account.number}`}
            >
              <span>{account.number}</span>
              {copied ? (
                <Check className="size-3 text-success-strong" aria-hidden />
              ) : (
                <Copy className="size-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
              )}
            </button>
            <span aria-hidden className="text-border">·</span>
            <span>Raiffeisenbank</span>
            <span aria-hidden className="text-border">·</span>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-xs"
              title="Aktualizovat data"
              aria-label="Aktualizovat data"
            >
              <RefreshCw className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <section aria-label="Vývoj a cashflow" className="space-y-3 sm:space-y-4">
        <div className="flex items-end justify-between gap-3 border-b pb-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Vývoj a cashflow</h2>
            <p className="text-xs text-muted-foreground">
              Měsíční příjmy a výdaje vs. průběh zůstatku na účtu
            </p>
          </div>
        </div>
        <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border/50 bg-card p-3 sm:p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cashflow po měsících
            </h3>
            <CashflowChart data={monthly} />
          </div>
          <div className="space-y-2 rounded-xl border border-border/50 bg-card p-3 sm:p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vývoj zůstatku
            </h3>
            <BalanceTrendChart data={trend} />
          </div>
        </div>
      </section>

      {/* Transactions Section */}
      <section aria-label="Pohyby na účtu" className="space-y-3 sm:space-y-4">
        <div className="flex items-end justify-between gap-3 border-b pb-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Pohyby na účtu</h2>
            <p className="text-xs text-muted-foreground">
              {visible.length} z {transactions.length} · řazeno od nejnovější
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledej podle popisu, protiúčtu nebo částky…"
              className="pl-9 text-xs sm:text-sm"
              aria-label="Hledat v transakcích"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as TransactionFilter)}>
            <SelectTrigger className="w-full text-xs sm:w-44 sm:text-sm" aria-label="Filtr typu transakce">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny transakce</SelectItem>
              <SelectItem value="income">Jen příjmy</SelectItem>
              <SelectItem value="expense">Jen výdaje</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TransactionsTable transactions={visible} />
      </section>
    </div>
  );
}
