import { describe, it, expect } from "vitest";

import {
  annotateTransactions,
  stripCardNumber,
  TRANSACTION_CATEGORY,
} from "./summary";
import type { TransactionNote } from "./transaction-notes";
import type { RbTransaction } from "./types";

function tx(overrides: Partial<RbTransaction>): RbTransaction {
  return {
    idTransaction: 1,
    accountName: "",
    info: "",
    transactionType: "Platba",
    accountNumber: "",
    amount: 0,
    datum: "2026-10-01T10:00:00",
    realizationDate: null,
    valutaDate: null,
    varSymbol: null,
    ...overrides,
  };
}

const NOTES: Record<number, TransactionNote> = {
  10: { description: "Vyklizení skladu", category: TRANSACTION_CATEGORY.SLUZBA },
  11: { description: "Vrácení příspěvku", category: TRANSACTION_CATEGORY.VRACENI },
};

describe("stripCardNumber", () => {
  it("removes PK card masks", () => {
    expect(stripCardNumber("PK:408361XXXXXX7726")).toBe("");
    expect(stripCardNumber("PK:408361XXXXXX9798 zasilkovna.cz; Praha 9, LIBE; CZE")).toBe(
      "zasilkovna.cz; Praha 9, LIBE; CZE",
    );
  });
});

describe("annotateTransactions", () => {
  it("uses the note when present and keeps the signed amount", () => {
    const [item] = annotateTransactions([tx({ idTransaction: 10, amount: -7500, info: "raw" })], NOTES);
    expect(item.description).toBe("Vyklizení skladu");
    expect(item.category).toBe("sluzba");
    expect(item.amount).toBe(-7500);
  });

  it("falls back to bank text without card number, jine for outgoing and prijem for incoming", () => {
    const items = annotateTransactions(
      [
        tx({ idTransaction: 20, amount: -30, info: "PK:408361XXXXXX7726 KSDS; Praha 1", datum: "2026-10-02T10:00:00" }),
        tx({ idTransaction: 21, amount: 500, info: "", accountName: "Družstvo A", datum: "2026-10-01T10:00:00" }),
      ],
      {},
    );
    expect(items[0].description).toBe("KSDS");
    expect(items[0].category).toBe("jine");
    expect(items[1].description).toBe("Družstvo A");
    expect(items[1].category).toBe("prijem");
  });

  it("uses the shop name from the payee field when the note holds only the card mask", () => {
    const [item] = annotateTransactions(
      [tx({ idTransaction: 23, amount: -30, info: "PK:408361XXXXXX7726", accountName: "KSDS; Praha 1; CZE" })],
      {},
    );
    expect(item.description).toBe("KSDS");
  });

  it("falls back to 'Platba kartou' when bank text is only a card mask", () => {
    const [item] = annotateTransactions([tx({ idTransaction: 22, amount: -30, info: "PK:408361XXXXXX7726" })], {});
    expect(item.description).toBe("Platba kartou");
  });

  it("drops invalid transactions and sorts newest first", () => {
    const items = annotateTransactions(
      [
        tx({ idTransaction: 1, amount: 1, datum: "2026-01-01T10:00:00" }),
        tx({ idTransaction: 2, amount: 1, datum: "not a date" }),
        tx({ idTransaction: 3, amount: 1, datum: "2026-05-01T10:00:00" }),
      ],
      {},
    );
    expect(items.map((i) => i.tx.idTransaction)).toEqual([3, 1]);
  });
});

describe("filterAnnotated", () => {
  it("matches description, category label and counterparty, and filters direction", async () => {
    const { filterAnnotated } = await import("./summary");
    const items = annotateTransactions(
      [
        tx({ idTransaction: 1, amount: 500, accountName: "Družstvo Alfa", datum: "2026-10-01T10:00:00" }),
        tx({ idTransaction: 10, amount: -7500, datum: "2026-10-02T10:00:00" }),
      ],
      NOTES,
    );
    expect(filterAnnotated(items, "sklad", "all").map((i) => i.tx.idTransaction)).toEqual([10]);
    expect(filterAnnotated(items, "služba", "all").map((i) => i.tx.idTransaction)).toEqual([10]);
    expect(filterAnnotated(items, "alfa", "all").map((i) => i.tx.idTransaction)).toEqual([1]);
    expect(filterAnnotated(items, "", "expense").map((i) => i.tx.idTransaction)).toEqual([10]);
    expect(filterAnnotated(items, "", "income").map((i) => i.tx.idTransaction)).toEqual([1]);
  });
});
