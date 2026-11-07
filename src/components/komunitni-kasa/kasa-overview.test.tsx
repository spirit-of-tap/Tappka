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

  it("does not show income or spending totals", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    await screen.findByText(czk(18000));
    expect(screen.queryByText(/letos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tento měsíc/i)).not.toBeInTheDocument();
  });

  it("lists the latest movements in both directions with readable descriptions", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const list = await screen.findByRole("list", { name: "Poslední pohyby" });
    expect(list).toHaveTextContent("Vyklizení a reorganizace skladu");
    expect(list).toHaveTextContent(`+${czk(20000)}`);
    expect(list).toHaveTextContent("KSDS");
    expect(list).not.toHaveTextContent("408361");
  });

  it("marks each movement as incoming or outgoing", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const list = await screen.findByRole("list", { name: "Poslední pohyby" });
    const rows = within(list).getAllByRole("listitem");
    const income = rows.find((r) => r.textContent?.includes("Družstvo A"));
    const expense = rows.find((r) => r.textContent?.includes("KSDS"));
    expect(within(income!).getByText("Příchozí platba")).toHaveClass("sr-only");
    expect(within(expense!).getByText("Odchozí platba")).toHaveClass("sr-only");
    expect(income!.querySelector("svg")).not.toBeNull();
  });

  it("offers a button to all movements under the list", async () => {
    mockFetch(response(HISTORY));
    render(<KasaOverview />);
    const link = await screen.findByRole("link", { name: "Zobrazit všechny pohyby" });
    expect(link).toHaveAttribute("href", "/komunitni-kasa/pohyby");
    const list = screen.getByRole("list", { name: "Poslední pohyby" });
    expect(list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows an empty state when the account has no movements", async () => {
    mockFetch(response([]));
    render(<KasaOverview />);
    expect(await screen.findByText("Zatím tu nejsou žádné pohyby")).toBeInTheDocument();
  });

  it("does not show the browser's English network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<KasaOverview />);
    expect(await screen.findByText("Data se nepodařilo načíst")).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
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
