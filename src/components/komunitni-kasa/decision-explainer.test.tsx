import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { EXPENSE_KINDS, SMERNICE_DRAFT_LABEL } from "@/lib/komunitni-kasa/smernice-data";
import { DecisionExplainer } from "./decision-explainer";

describe("DecisionExplainer", () => {
  it("is labelled as a draft", () => {
    render(<DecisionExplainer />);
    expect(screen.getByText(SMERNICE_DRAFT_LABEL)).toBeInTheDocument();
  });

  it("says in one sentence each who decides small and big expenses", () => {
    render(<DecisionExplainer />);
    const rules = screen.getAllByRole("listitem");
    expect(rules).toHaveLength(EXPENSE_KINDS.length);
    expect(rules[0]).toHaveTextContent(EXPENSE_KINDS[0].plain);
    expect(rules[1]).toHaveTextContent(EXPENSE_KINDS[1].plain);
  });

  it("links to the full text", () => {
    render(<DecisionExplainer />);
    expect(screen.getByRole("link", { name: /celé znění směrnice/i })).toHaveAttribute(
      "href",
      "/komunitni-kasa/dokumenty/smernice",
    );
  });
});

describe("DecisionExplainer once approved", () => {
  it("drops the draft label when the flag is off", async () => {
    vi.resetModules();
    vi.doMock("@/lib/komunitni-kasa/smernice-data", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/komunitni-kasa/smernice-data")>()),
      SMERNICE_IS_DRAFT: false,
    }));
    const { DecisionExplainer: Approved } = await import("./decision-explainer");
    render(<Approved />);
    expect(screen.queryByText(SMERNICE_DRAFT_LABEL)).not.toBeInTheDocument();
    vi.doUnmock("@/lib/komunitni-kasa/smernice-data");
  });
});
