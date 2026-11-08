import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import {
  stripCardNumber,
  TRANSACTION_CATEGORY_LABELS,
  type AnnotatedTransaction,
} from "@/lib/komunitni-kasa/summary";
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

/** Protiúčet pod popisem — jen pokud říká něco navíc (u plateb kartou banka uvádí vlastní účet kasy). */
function detail(item: AnnotatedTransaction, ownAccountNumber?: string): string {
  const name = stripCardNumber(item.tx.accountName ?? "");
  const account = item.tx.accountNumber && item.tx.accountNumber !== ownAccountNumber ? item.tx.accountNumber : null;
  return [name && name !== item.description ? name : null, account]
    .filter(Boolean)
    .join(" · ");
}

function Amount({ value, className }: { value: number; className?: string }) {
  const income = value > 0;
  return (
    <span
      className={cn(
        "whitespace-nowrap font-medium tabular-nums",
        income ? "text-success-strong" : "text-foreground",
        className,
      )}
    >
      {income ? "+" : "−"}
      {formatCzk(Math.abs(value))}
    </span>
  );
}

function DirectionIcon({ income }: { income: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        income ? "bg-success/10 text-success-strong" : "bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
    </span>
  );
}

export function TransactionsTable({ items, ownAccountNumber }: { items: AnnotatedTransaction[]; ownAccountNumber?: string }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nic tu není, zkus upravit hledání nebo filtr</p>;
  }
  return (
    <div>
      {/* Mobil: seznam, nikdy nepřeteče do šířky */}
      <ul className="divide-y border-y sm:hidden">
        {items.map((item) => {
          const sub = detail(item, ownAccountNumber);
          return (
            <li key={item.tx.idTransaction} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <DirectionIcon income={item.amount > 0} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dateFormatter.format(item.date)} · {TRANSACTION_CATEGORY_LABELS[item.category]}
                    {sub ? ` · ${sub}` : ""}
                  </p>
                </div>
              </div>
              <Amount value={item.amount} className="text-sm" />
            </li>
          );
        })}
      </ul>

      {/* Desktop: tabulka */}
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Datum</TableHead>
              <TableHead>Popis</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Částka</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const sub = detail(item, ownAccountNumber);
              return (
                <TableRow key={item.tx.idTransaction}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                    {dateFormatter.format(item.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <DirectionIcon income={item.amount > 0} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.description}</p>
                        {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TRANSACTION_CATEGORY_LABELS[item.category]}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Amount value={item.amount} />
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
