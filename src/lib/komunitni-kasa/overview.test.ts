import { describe, expect, it } from "vitest";

import { computeTrendWindow, computeYearTotals, groupByMonth, TREND_WINDOW_MONTHS } from "./overview";
import { formatCzk, type BalancePoint } from "./stats";
import type { AnnotatedTransaction } from "./summary";
import { TRANSACTION_CATEGORY } from "./transaction-notes";

function item(id: number, amount: number, iso: string): AnnotatedTransaction {
  return {
    tx: {
      idTransaction: id,
      accountName: "",
      info: "",
      transactionType: "",
      accountNumber: "",
      amount,
      datum: iso,
      realizationDate: null,
      valutaDate: null,
      varSymbol: null,
    },
    date: new Date(iso),
    description: "x",
    category: TRANSACTION_CATEGORY.JINE,
    amount,
  };
}

function point(iso: string, balance: number): BalancePoint {
  const date = new Date(iso);
  return { key: iso, time: date.getTime(), label: iso, balance };
}

const norm = (s: string) => s.replace(/\s/g, " ");

describe("computeYearTotals", () => {
  it("sums income and spending of the given year only", () => {
    const totals = computeYearTotals(
      [
        item(1, 1000, "2026-02-01T10:00:00"),
        item(2, 500, "2026-03-01T10:00:00"),
        item(3, -300, "2026-04-01T10:00:00"),
        item(4, -9999, "2025-12-31T10:00:00"),
        item(5, 0, "2026-05-01T10:00:00"),
      ],
      2026,
    );
    expect(totals).toEqual({ income: { sum: 1500, count: 2 }, expense: { sum: 300, count: 1 } });
  });

  it("returns zeros for an empty list", () => {
    expect(computeYearTotals([], 2026)).toEqual({ income: { sum: 0, count: 0 }, expense: { sum: 0, count: 0 } });
  });
});

describe("groupByMonth", () => {
  it("groups consecutive movements by month keeping order", () => {
    const groups = groupByMonth([
      item(1, 1, "2026-10-29T10:00:00"),
      item(2, 1, "2026-10-02T10:00:00"),
      item(3, 1, "2026-09-30T10:00:00"),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.items.length])).toEqual([
      ["2026-10", "říjen 2026", 2],
      ["2026-09", "září 2026", 1],
    ]);
  });

  it("returns no groups for no movements", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("computeTrendWindow", () => {
  const now = new Date("2026-11-24T12:00:00");

  it("keeps only the last 12 months and describes the change", () => {
    const window = computeTrendWindow(
      [point("2025-10-15T10:00:00", 100), point("2025-12-05T10:00:00", 1000), point("2026-11-10T10:00:00", 18000)],
      now,
    );
    expect(window?.points).toHaveLength(2);
    expect(window?.periodLabel).toBe("prosinec 2025 – listopad 2026");
    expect(norm(window!.summary)).toBe(
      `Za ${TREND_WINDOW_MONTHS} měsíců zůstatek vzrostl z ${norm(formatCzk(1000))} na ${norm(formatCzk(18000))}`,
    );
  });

  it("says the balance dropped or stayed", () => {
    const down = computeTrendWindow([point("2026-05-01T10:00:00", 500), point("2026-06-01T10:00:00", 200)], now);
    expect(down?.summary).toContain("klesl");
    const flat = computeTrendWindow([point("2026-05-01T10:00:00", 500), point("2026-06-01T10:00:00", 500)], now);
    expect(flat?.summary).toContain("zůstal stejný");
  });

  it("returns null with fewer than two points in the window", () => {
    expect(computeTrendWindow([], now)).toBeNull();
    expect(computeTrendWindow([point("2026-05-01T10:00:00", 500)], now)).toBeNull();
    expect(computeTrendWindow([point("2024-05-01T10:00:00", 1), point("2026-05-01T10:00:00", 2)], now)).toBeNull();
  });
});
