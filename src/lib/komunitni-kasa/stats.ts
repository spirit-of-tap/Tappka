import type { RbTransaction } from "./types";

export const KASA_BANK_ACCOUNT_ID = 45012256;
export const KASA_MAX_PAGES = 20;
export const KASA_PAGE_SIZE = 50;

export interface BalancePoint {
  key: string;
  /** Čas pohybu v ms — osa grafu je časová, ne pořadová. */
  time: number;
  label: string;
  balance: number;
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
      time: date.getTime(),
      label: date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "2-digit" }),
      balance: Math.round(running * 100) / 100,
    };
  });
}

export type TransactionFilter = "all" | "income" | "expense";

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatCzk(value: number): string {
  return czkFormatter.format(value);
}
