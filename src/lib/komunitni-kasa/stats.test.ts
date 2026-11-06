import { describe, expect, it } from "vitest";

import type { RbTransaction } from "./types";
import {
  computeBalanceTrend,
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

describe("formatCzk", () => {
  it("formátuje české koruny", () => {
    expect(formatCzk(18000)).toContain("18");
    expect(formatCzk(-169)).toContain("169");
  });
});
