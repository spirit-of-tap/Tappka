import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { KasaResponse } from "@/lib/komunitni-kasa/types";
import { KomunitniKasaView } from "./komunitni-kasa-view";

const mockKasaData: KasaResponse = {
  account: {
    name: "Spirit of TAP, z.s.",
    number: "223152036/5500",
    balance: 18000,
    currency: "CZK",
  },
  transactions: [
    {
      idTransaction: 101,
      accountName: "Členský vklad",
      info: "Příspěvek na činnost",
      transactionType: "Platba",
      accountNumber: "123456/0100",
      amount: 20000,
      datum: "2026-05-01",
      realizationDate: "2026-05-01",
      valutaDate: null,
      varSymbol: "202601",
    },
    {
      idTransaction: 102,
      accountName: "Kancelářské potřeby",
      info: "Nákup papírů a tisk",
      transactionType: "Platba kartou",
      accountNumber: "654321/0800",
      amount: -2000,
      datum: "2026-05-02",
      realizationDate: "2026-05-02",
      valutaDate: null,
      varSymbol: null,
    },
  ],
  fetchedAt: "2026-05-02T12:00:00Z",
};

describe("KomunitniKasaView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKasaData,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders compact header card with transparent account link and stanovy link", async () => {
    render(<KomunitniKasaView />);

    await waitFor(() => {
      expect(screen.getByText("Spirit of TAP, z.s.")).toBeInTheDocument();
    });

    // Check link to Raiffeisenbank transparent account
    const rbLink = screen.getByRole("link", { name: /otevřít v bance/i });
    expect(rbLink).toBeInTheDocument();
    expect(rbLink).toHaveAttribute(
      "href",
      "https://www.rb.cz/povinne-zverejnovane-informace/transparentni-ucty?path=transactions&accountNumber=223152036",
    );
    expect(rbLink).toHaveAttribute("target", "_blank");

    // Check link to Stanovy & rejstřík subpage
    const stanovyLink = screen.getByRole("link", { name: /stanovy/i });
    expect(stanovyLink).toBeInTheDocument();
    expect(stanovyLink).toHaveAttribute("href", "/komunitni-kasa/stanovy");
  });

  it("renders compact header with balance and eliminates turnover cards", async () => {
    render(<KomunitniKasaView />);

    await waitFor(() => {
      expect(screen.getByText("Spirit of TAP, z.s.")).toBeInTheDocument();
    });

    expect(screen.getByText("Aktuální zůstatek")).toBeInTheDocument();
    expect(screen.getByText("18 000 Kč")).toBeInTheDocument();

    // Verify copy button is present
    expect(screen.getByRole("button", { name: /zkopírovat číslo účtu/i })).toBeInTheDocument();

    // Verify unnecessary turnover cards are removed
    expect(screen.queryByText("Příjmy celkem")).not.toBeInTheDocument();
    expect(screen.queryByText("Výdaje celkem")).not.toBeInTheDocument();
    expect(screen.queryByText("Netto cashflow")).not.toBeInTheDocument();
  });
});
