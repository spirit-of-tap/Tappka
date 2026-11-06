import { describe, it, expect } from "vitest";

import {
  DECISION_CYCLE,
  EXPENSE_KINDS,
  OPERATIONAL_LIMIT_EXAMPLE,
  SMERNICE_ARTICLES,
  SMERNICE_IS_DRAFT,
  operationalLimit,
} from "./smernice-data";

describe("smernice data", () => {
  it("has the six articles in order", () => {
    expect(SMERNICE_ARTICLES.map((a) => [a.number, a.title])).toEqual([
      [1, "Základní zásady"],
      [2, "Potřeby členů a plán výdajů"],
      [3, "Provozní výdaje"],
      [4, "Strategické výdaje"],
      [5, "Transparentnost a označení"],
      [6, "Závěrečná ustanovení"],
    ]);
    expect(SMERNICE_ARTICLES.every((a) => a.paragraphs.length > 0)).toBe(true);
  });

  it("is marked as a draft", () => {
    expect(SMERNICE_IS_DRAFT).toBe(true);
  });

  it("lists operational before strategic expenses", () => {
    expect(EXPENSE_KINDS.map((k) => k.id)).toEqual(["provozni", "strategicke"]);
  });

  it("describes the monthly cycle in four steps", () => {
    expect(DECISION_CYCLE).toHaveLength(4);
  });

  it("computes the limit example as 2 565 Kč", () => {
    expect(OPERATIONAL_LIMIT_EXAMPLE).toEqual({ members: 45, contribution: 190, percent: 30 });
    expect(operationalLimit(OPERATIONAL_LIMIT_EXAMPLE)).toBe(2565);
  });

  it("keeps the lettered items of čl. 4 odst. 1 in one paragraph", () => {
    const first = SMERNICE_ARTICLES[3].paragraphs[0];
    expect(first).toContain("a) opakovaná platba nebo předplatné;");
    expect(first).toContain("e) každý jiný výdaj");
  });
});
