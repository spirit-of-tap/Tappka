"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { RbTransaction } from "@/lib/komunitni-kasa/types";
import { formatCzk, transactionDate } from "@/lib/komunitni-kasa/stats";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function counterparty(tx: RbTransaction): string {
  return tx.accountName.trim() || tx.info.trim() || "Bez popisu";
}

export function TransactionsTable({ transactions }: { transactions: RbTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nic tu zatím není, zkus upravit filtr
      </p>
    );
  }
  return (
    <div>
      {/* Mobile native list view (< sm): never overflows horizontally */}
      <div className="divide-y rounded-lg border sm:hidden">
        {transactions.map((tx) => {
          const income = tx.amount > 0;
          const date = transactionDate(tx);
          return (
            <div
              key={tx.idTransaction}
              className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    income
                      ? "bg-success/10 text-success-strong"
                      : "bg-destructive/10 text-destructive",
                  )}
                  aria-hidden
                >
                  {income ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {counterparty(tx)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[tx.info.trim() && tx.accountName.trim() ? tx.info.trim() : null, tx.accountNumber]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "whitespace-nowrap font-mono text-xs font-semibold tabular-nums",
                    income ? "text-success-strong" : "text-destructive",
                  )}
                >
                  {income ? "+" : ""}
                  {formatCzk(tx.amount)}
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {Number.isNaN(date.getTime())
                    ? "—"
                    : date.toLocaleDateString("cs-CZ", {
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                      })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view (>= sm) */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3 text-sm">Datum</TableHead>
              <TableHead className="px-4 py-3 text-sm">Popis a protiúčet</TableHead>
              <TableHead className="px-4 py-3 text-sm">Typ</TableHead>
              <TableHead className="px-4 py-3 text-right text-sm">Částka</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const income = tx.amount > 0;
              const date = transactionDate(tx);
              return (
                <TableRow key={tx.idTransaction}>
                  <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-muted-foreground">
                    {Number.isNaN(date.getTime())
                      ? "—"
                      : date.toLocaleDateString("cs-CZ", {
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                        })}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          income
                            ? "bg-success/10 text-success-strong"
                            : "bg-destructive/10 text-destructive",
                        )}
                        aria-hidden
                      >
                        {income ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowDownRight className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{counterparty(tx)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[tx.info.trim() && tx.accountName.trim() ? tx.info.trim() : null, tx.accountNumber]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-44 truncate px-4 py-3">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {tx.transactionType || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums",
                      income ? "text-success-strong" : "text-destructive",
                    )}
                  >
                    {income ? "+" : ""}
                    {formatCzk(tx.amount)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
