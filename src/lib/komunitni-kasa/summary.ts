import { isTransactionValid, transactionDate, type TransactionFilter } from "./stats";
import {
  TRANSACTION_CATEGORY,
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_NOTES,
  type TransactionCategory,
  type TransactionNote,
} from "./transaction-notes";
import type { RbTransaction } from "./types";

export { TRANSACTION_CATEGORY, TRANSACTION_CATEGORY_LABELS } from "./transaction-notes";
export type { TransactionCategory, TransactionNote } from "./transaction-notes";

export const RECENT_EXPENSES_LIMIT = 6;

const CARD_MASK_PATTERN = /PK:\s*\d{6}X+\d{4}/gi;
const CARD_PAYMENT_FALLBACK = "Platba kartou";
const NO_DESCRIPTION_FALLBACK = "Bez popisu";

export interface AnnotatedTransaction {
  tx: RbTransaction;
  date: Date;
  description: string;
  category: TransactionCategory;
  amount: number;
}

export interface PeriodSummary {
  income: number;
  spending: number;
  refunds: number;
  count: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Odstraní maskované číslo karty („PK:408361XXXXXX7726“) z textu banky. */
export function stripCardNumber(text: string): string {
  return text.replace(CARD_MASK_PATTERN, "").replace(/\s+/g, " ").trim();
}

function fallbackDescription(tx: RbTransaction): string {
  const info = stripCardNumber(tx.info ?? "");
  if (info) return info;
  const name = stripCardNumber(tx.accountName ?? "");
  if (name) return name;
  const hadCardMask = new RegExp(CARD_MASK_PATTERN.source, "i").test(`${tx.info ?? ""} ${tx.accountName ?? ""}`);
  return hadCardMask ? CARD_PAYMENT_FALLBACK : NO_DESCRIPTION_FALLBACK;
}

/** Platné transakce s popisem a kategorií, od nejnovější. */
export function annotateTransactions(
  txs: RbTransaction[],
  notes: Readonly<Record<number, TransactionNote>> = TRANSACTION_NOTES,
): AnnotatedTransaction[] {
  return txs
    .filter(isTransactionValid)
    .map((tx) => {
      const note = notes[tx.idTransaction];
      return {
        tx,
        date: transactionDate(tx),
        description: note?.description ?? fallbackDescription(tx),
        category:
          note?.category ?? (tx.amount > 0 ? TRANSACTION_CATEGORY.PRIJEM : TRANSACTION_CATEGORY.JINE),
        amount: tx.amount,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function isRefund(item: AnnotatedTransaction): boolean {
  return item.category === TRANSACTION_CATEGORY.VRACENI;
}

/** Souhrn za období [from, to). Vrácení družstvům se nepočítá do výdajů. */
export function summarizePeriod(items: AnnotatedTransaction[], from: Date, to: Date): PeriodSummary {
  const summary: PeriodSummary = { income: 0, spending: 0, refunds: 0, count: 0 };
  for (const item of items) {
    if (item.date < from || item.date >= to) continue;
    summary.count += 1;
    if (item.amount > 0) summary.income += item.amount;
    else if (isRefund(item)) summary.refunds += Math.abs(item.amount);
    else summary.spending += Math.abs(item.amount);
  }
  return summary;
}

export function monthRange(now: Date): DateRange {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export function yearRange(now: Date): DateRange {
  return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
}

/** Odchozí výdaje (bez vrácení družstvům), od nejnovějšího. */
export function recentExpenses(items: AnnotatedTransaction[], limit: number): AnnotatedTransaction[] {
  return items.filter((item) => item.amount < 0 && !isRefund(item)).slice(0, limit);
}

/** Hledání v popisu, kategorii, protiúčtu a částce + filtr směru platby. */
export function filterAnnotated(
  items: AnnotatedTransaction[],
  query: string,
  filter: TransactionFilter,
): AnnotatedTransaction[] {
  const q = query.trim().toLocaleLowerCase("cs");
  return items.filter((item) => {
    if (filter === "income" && item.amount <= 0) return false;
    if (filter === "expense" && item.amount >= 0) return false;
    if (!q) return true;
    const haystack = [
      item.description,
      TRANSACTION_CATEGORY_LABELS[item.category],
      stripCardNumber(item.tx.accountName ?? ""),
      item.tx.varSymbol,
      String(Math.abs(item.amount)),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("cs");
    return haystack.includes(q);
  });
}
