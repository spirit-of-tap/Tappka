import { describe, expect, it } from "vitest";

import type { RbTransaction } from "./types";
import {
  computeBalanceTrend,
  computeMonthlyCashflow,
  computeTotals,
  filterTransactions,
  formatCzk,
} from "./stats";

function tx(overrides: Partial<RbTransaction> & { amount: number; datum: string }): RbTransaction {
  return {
    idTransaction: Math.floor(Math.random() * 1_000_000),
    accountName: "",
    info: "",
    transactionType: "Převod",
    accountNumber: "223152036/5500",
    realizationDate: null,
    valutaDate: null,
    varSymbol: null,
    ...overrides,
  };
}

describe("computeTotals", () => {
  it("sečte příjmy, výdaje a netto", () => {
    const totals = computeTotals([
      tx({ amount: 7000, datum: "2025-11-12T11:20:38Z" }),
      tx({ amount: -5640, datum: "2025-11-12T11:00:00Z" }),
      tx({ amount: -169, datum: "2025-11-24T15:24:57Z" }),
    ]);
    expect(totals).toEqual({ income: 7000, expense: 5809, net: 1191, count: 3 });
  });

  it("ignoruje neplatné transakce", () => {
    expect(computeTotals([tx({ amount: NaN, datum: "2025-11-12T11:00:00Z" })])).toEqual({
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    });
  });
});

describe("computeMonthlyCashflow", () => {
  it("agreguje po měsících a doplní chybějící měsíce", () => {
    const result = computeMonthlyCashflow([
      tx({ amount: 7000, datum: "2025-11-12T11:20:38Z" }),
      tx({ amount: -5640, datum: "2025-11-12T11:00:00Z" }),
      tx({ amount: 18000, datum: "2026-06-30T08:50:05Z" }),
    ]);
    // 11/2025 … 06/2026 = 8 měsíců
    expect(result).toHaveLength(8);
    expect(result[0]).toMatchObject({ key: "2025-11", income: 7000, expense: 5640, net: 1360 });
    expect(result[1]).toMatchObject({ key: "2025-12", income: 0, expense: 0, count: 0 });
    expect(result[7]).toMatchObject({ key: "2026-06", income: 18000 });
  });

  it("vrátí prázdné pole bez transakcí", () => {
    expect(computeMonthlyCashflow([])).toEqual([]);
  });
});

describe("computeBalanceTrend", () => {
  it("odvodí počáteční stav ze současného zůstatku", () => {
    const points = computeBalanceTrend(
      [
        tx({ idTransaction: 1, amount: 7500, datum: "2025-07-13T23:26:57Z" }),
        tx({ idTransaction: 2, amount: -7500, datum: "2025-07-15T11:22:53Z" }),
      ],
      18000,
    );
    expect(points.map((p) => p.balance)).toEqual([25500, 18000]);
  });
});

describe("filterTransactions", () => {
  const data = [
    tx({ amount: 7000, datum: "2025-11-12T11:20:38Z", info: "PAVIAAN CO DRUZSTVO" }),
    tx({ amount: -169, datum: "2025-11-24T15:24:57Z", info: "Proplacení účtenky" }),
  ];

  it("filtruje podle typu", () => {
    expect(filterTransactions(data, "", "income")).toHaveLength(1);
    expect(filterTransactions(data, "", "expense")).toHaveLength(1);
    expect(filterTransactions(data, "", "all")).toHaveLength(2);
  });

  it("vyhledává v popisu bez ohledu na velikost písmen", () => {
    expect(filterTransactions(data, "účtenky", "all")).toHaveLength(1);
    expect(filterTransactions(data, "neexistuje", "all")).toHaveLength(0);
  });
});

describe("formatCzk", () => {
  it("formátuje české koruny", () => {
    expect(formatCzk(18000)).toContain("18");
    expect(formatCzk(-169)).toContain("169");
  });
});
