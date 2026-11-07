import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { formatCzk } from "@/lib/komunitni-kasa/stats";
import type { KasaResponse, RbTransaction } from "@/lib/komunitni-kasa/types";
import { KasaOverview } from "./kasa-overview";

function tx(overrides: Partial<RbTransaction>): RbTransaction {
  return {
    idTransaction: 1,
    accountName: "",
    info: "",
    transactionType: "Platba",
    accountNumber: "",
    amount: 0,
    datum: "2026-05-01T10:00:00",
    realizationDate: null,
    valutaDate: null,
    varSymbol: null,
    ...overrides,
  };
}

function response(transactions: RbTransaction[]): KasaResponse {
  return {
    account: { name: "Spirit of TAP, z.s.", number: "223152036/5500", balance: 18000, currency: "CZK" },
    transactions,
    fetchedAt: "2026-11-06T10:00:00Z",
  };
}

const HISTORY = [
  tx({ idTransaction: 1, amount: 20000, accountName: "Družstvo A", datum: "2026-05-01T10:00:00" }),
  tx({ idTransaction: 9615689405, amount: -7500, info: "raw", datum: "2026-06-01T10:00:00" }),
  tx({ idTransaction: 8496134238, amount: -4582, info: "raw refund", datum: "2026-07-01T10:00:00" }),
  tx({ idTransaction: 77, amount: -30, info: "PK:408361XXXXXX7726 KSDS; Praha 1", datum: "2026-10-29T10:00:00" }),
];

// Testing Library normalizes NBSP from Intl to plain spaces.
const czk = (value: number) => formatCzk(value).replace(/\s/g, " ");

function mockFetch(data: KasaResponse) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("KasaOverview", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the balance", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    expect(await screen.findByText(czk(18000))).toBeInTheDocument();
  });

  it("says the month has no movement instead of showing zeros", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const line = await screen.findByText("Tento měsíc zatím bez pohybu");
    expect(line.textContent).not.toContain("0 Kč");
  });

  it("lists annotated expenses with their category and leaves refunds out", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const list = await screen.findByRole("list", { name: "Poslední výdaje" });
    expect(list).toHaveTextContent("Vyklizení a reorganizace skladu");
    expect(list).toHaveTextContent("Služba");
    expect(list).not.toHaveTextContent("Vrácení nevyčerpané části příspěvku");
  });

  it("shows this year's income and spending as two figures, without refunds", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const year = await screen.findByRole("list", { name: "Letos" });
    expect(within(year).getByText("Příjmy").nextSibling).toHaveTextContent(czk(20000));
    expect(within(year).getByText("Výdaje").nextSibling).toHaveTextContent(czk(7530));
    expect(within(year).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/vráceno/i)).not.toBeInTheDocument();
  });

  it("keeps the balance chart off the overview", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    await screen.findByText(czk(18000));
    expect(screen.queryByText("Vývoj zůstatku od založení účtu")).not.toBeInTheDocument();
  });

  it("hides card numbers of unannotated card payments", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    expect(await screen.findByText("KSDS")).toBeInTheDocument();
    expect(screen.queryByText(/408361/)).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no expenses", async () => {
    mockFetch(response([]));
    render(<KasaOverview />);
    expect(await screen.findByText("Zatím tu nejsou žádné výdaje")).toBeInTheDocument();
  });

  it("links to all transactions", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const link = await screen.findByRole("link", { name: /zobrazit všechny pohyby/i });
    expect(link).toHaveAttribute("href", "/komunitni-kasa/pohyby");
  });

  it("does not show the browser's English network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<KasaOverview />);
    expect(await screen.findByText("Data se nepodařilo načíst")).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it("treats a month with only zero-amount items as without movement", async () => {
    mockFetch(response([...HISTORY, tx({ idTransaction: 500, amount: 0, datum: "2026-11-02T10:00:00" })]));
    render(<KasaOverview />);
    expect(await screen.findByText("Tento měsíc zatím bez pohybu")).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Síť nedostupná"));
    vi.stubGlobal("fetch", fn);
    render(<KasaOverview />);
    expect(await screen.findByText("Data se nepodařilo načíst")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /načíst znovu/i }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });
});
