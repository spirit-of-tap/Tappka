import type { RbTransaction } from "./types";

export const KASA_BANK_ACCOUNT_ID = 45012256;
export const KASA_MAX_PAGES = 20;
export const KASA_PAGE_SIZE = 50;

export interface MonthlyCashflow {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface BalancePoint {
  key: string;
  label: string;
  balance: number;
}

export interface KasaTotals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

/** Rozhodné datum transakce — realizace, jinak datum zaúčtování. */
export function transactionDate(tx: RbTransaction): Date {
  return new Date(tx.realizationDate ?? tx.datum ?? tx.valutaDate ?? "");
}

export function isTransactionValid(tx: RbTransaction): boolean {
  return (
    typeof tx.amount === "number" &&
    Number.isFinite(tx.amount) &&
    !Number.isNaN(transactionDate(tx).getTime())
  );
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function computeTotals(transactions: RbTransaction[]): KasaTotals {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const tx of transactions) {
    if (!isTransactionValid(tx)) continue;
    count += 1;
    if (tx.amount > 0) income += tx.amount;
    else expense += Math.abs(tx.amount);
  }
  return { income, expense, net: income - expense, count };
}

/**
 * Měsíční cashflow seřazené od nejstaršího měsíce. Chybějící měsíce mezi
 * první a poslední transakcí se doplní nulami, aby graf neměl díry.
 */
export function computeMonthlyCashflow(transactions: RbTransaction[]): MonthlyCashflow[] {
  const valid = transactions.filter(isTransactionValid);
  if (valid.length === 0) return [];

  const byMonth = new Map<string, MonthlyCashflow>();
  for (const tx of valid) {
    const date = transactionDate(tx);
    const key = monthKey(date);
    const entry = byMonth.get(key) ?? {
      key,
      label: monthLabel(date),
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    };
    if (tx.amount > 0) entry.income += tx.amount;
    else entry.expense += Math.abs(tx.amount);
    entry.count += 1;
    byMonth.set(key, entry);
  }

  const keys = [...byMonth.keys()].sort();
  const [firstYear, firstMonth] = keys[0].split("-").map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split("-").map(Number);

  const result: MonthlyCashflow[] = [];
  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const end = new Date(lastYear, lastMonth - 1, 1);
  while (cursor <= end) {
    const key = monthKey(cursor);
    result.push(
      byMonth.get(key) ?? { key, label: monthLabel(cursor), income: 0, expense: 0, net: 0, count: 0 },
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const entry of result) entry.net = entry.income - entry.expense;
  return result;
}

/**
 * Vývoj zůstatku v čase. Počáteční stav se odvodí ze současného zůstatku
 * minus součet všech stažených transakcí.
 */
export function computeBalanceTrend(
  transactions: RbTransaction[],
  currentBalance: number | null,
): BalancePoint[] {
  const valid = transactions.filter(isTransactionValid).sort(
    (a, b) => transactionDate(a).getTime() - transactionDate(b).getTime(),
  );
  if (valid.length === 0) return [];

  const net = valid.reduce((sum, tx) => sum + tx.amount, 0);
  let running = (currentBalance ?? net) - net;
  return valid.map((tx) => {
    running += tx.amount;
    const date = transactionDate(tx);
    return {
      key: `${tx.idTransaction}`,
      label: date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "2-digit" }),
      balance: Math.round(running * 100) / 100,
    };
  });
}

export type TransactionFilter = "all" | "income" | "expense";

export function filterTransactions(
  transactions: RbTransaction[],
  query: string,
  filter: TransactionFilter,
): RbTransaction[] {
  const q = query.trim().toLowerCase();
  return transactions.filter((tx) => {
    if (filter === "income" && tx.amount <= 0) return false;
    if (filter === "expense" && tx.amount >= 0) return false;
    if (!q) return true;
    const haystack = [tx.info, tx.accountName, tx.transactionType, tx.varSymbol, String(tx.amount)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatCzk(value: number): string {
  return czkFormatter.format(value);
}
