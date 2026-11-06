import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DECISION_CYCLE, EXPENSE_KINDS, SMERNICE_DRAFT_LABEL } from "@/lib/komunitni-kasa/smernice-data";
import { DecisionExplainer } from "./decision-explainer";

describe("DecisionExplainer", () => {
  it("is labelled as a draft", () => {
    render(<DecisionExplainer />);
    expect(screen.getByText(SMERNICE_DRAFT_LABEL)).toBeInTheDocument();
  });

  it("explains both kinds of expense and the four cycle steps", () => {
    render(<DecisionExplainer />);
    for (const kind of EXPENSE_KINDS) expect(screen.getByRole("heading", { name: kind.title })).toBeInTheDocument();
    for (const step of DECISION_CYCLE) expect(screen.getByText(step.title)).toBeInTheDocument();
    expect(screen.getByText(/2\s565\sKč/)).toBeInTheDocument();
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
