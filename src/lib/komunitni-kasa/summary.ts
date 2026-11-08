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

/** Odstraní maskované číslo karty („PK:408361XXXXXX7726“) z textu banky. */
export function stripCardNumber(text: string): string {
  return text.replace(CARD_MASK_PATTERN, "").replace(/\s+/g, " ").trim();
}

/** U platby kartou banka píše „obchod; město, ulice; země“ — stačí název obchodu. */
function merchantName(text: string): string {
  return text.split(";")[0].trim();
}

function fallbackDescription(tx: RbTransaction): string {
  const raw = `${tx.info ?? ""} ${tx.accountName ?? ""}`;
  const cardPayment = new RegExp(CARD_MASK_PATTERN.source, "i").test(raw);
  const text = stripCardNumber(tx.info ?? "") || stripCardNumber(tx.accountName ?? "");
  if (text) return cardPayment ? merchantName(text) || text : text;
  return cardPayment ? CARD_PAYMENT_FALLBACK : NO_DESCRIPTION_FALLBACK;
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
