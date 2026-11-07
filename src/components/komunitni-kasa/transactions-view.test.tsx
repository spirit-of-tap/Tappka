import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { KasaResponse, RbTransaction } from "@/lib/komunitni-kasa/types";
import { TransactionsView } from "./transactions-view";

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

const DATA: KasaResponse = {
  account: { name: "Spirit of TAP, z.s.", number: "223152036/5500", balance: 18000, currency: "CZK" },
  transactions: [
    tx({ idTransaction: 1, amount: 20000, accountName: "Družstvo Alfa", datum: "2026-05-01T10:00:00" }),
    tx({ idTransaction: 9615689405, amount: -7500, info: "raw", datum: "2026-06-01T10:00:00" }),
    tx({ idTransaction: 77, amount: -30, info: "PK:408361XXXXXX7726 KSDS; Praha 1", accountNumber: "223152036/5500", datum: "2026-10-29T10:00:00" }),
  ],
  fetchedAt: "2026-11-06T10:00:00Z",
};

function rowsMentioning(text: string) {
  return screen.queryAllByText(text);
}

describe("TransactionsView", () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockOk() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DATA }));
  }

  it("shows annotated descriptions and hides card numbers", async () => {
    mockOk();
    render(<TransactionsView />);
    expect((await screen.findAllByText("Vyklizení a reorganizace skladu")).length).toBeGreaterThan(0);
    expect(rowsMentioning("KSDS").length).toBeGreaterThan(0);
    expect(screen.queryByText(/408361/)).not.toBeInTheDocument();
  });

  it("does not show the kasa's own account as the counterparty", async () => {
    mockOk();
    render(<TransactionsView />);
    await screen.findAllByText("KSDS");
    expect(screen.queryByText(/223152036/)).not.toBeInTheDocument();
  });

  it("narrows rows by search", async () => {
    mockOk();
    render(<TransactionsView />);
    await screen.findAllByText("Družstvo Alfa");
    fireEvent.change(screen.getByRole("searchbox", { name: /hledat/i }), { target: { value: "sklad" } });
    expect(rowsMentioning("Družstvo Alfa")).toHaveLength(0);
    expect(rowsMentioning("Vyklizení a reorganizace skladu").length).toBeGreaterThan(0);
  });

  it("hides incoming payments when filtering expenses", async () => {
    mockOk();
    render(<TransactionsView />);
    await screen.findAllByText("Družstvo Alfa");
    fireEvent.click(screen.getByRole("radio", { name: "Výdaje" }));
    expect(rowsMentioning("Družstvo Alfa")).toHaveLength(0);
    expect(rowsMentioning("KSDS").length).toBeGreaterThan(0);
  });

  it("shows an error with retry", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Síť nedostupná"));
    vi.stubGlobal("fetch", fn);
    render(<TransactionsView />);
    fireEvent.click(await screen.findByRole("button", { name: /načíst znovu/i }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });
});
