import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SMERNICE_ARTICLES, SMERNICE_DRAFT_LABEL } from "@/lib/komunitni-kasa/smernice-data";
import { DocumentList } from "./document-list";
import { SmerniceView } from "./smernice-view";

describe("DocumentList", () => {
  it("lists the society documents", () => {
    render(<DocumentList />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading").textContent)).toEqual([
      "Stanovy",
      "Směrnice o rozhodování o výdajích",
      "Zápis z členské schůze 3. 6. 2026",
      "Výpis ze spolkového rejstříku",
      "Sbírka listin",
    ]);
  });

  it("opens stanovy and směrnice inside the app", () => {
    render(<DocumentList />);
    expect(screen.getByRole("link", { name: /číst stanovy/i })).toHaveAttribute(
      "href",
      "/komunitni-kasa/dokumenty/stanovy",
    );
    expect(screen.getByRole("link", { name: /číst směrnici/i })).toHaveAttribute(
      "href",
      "/komunitni-kasa/dokumenty/smernice",
    );
  });

  it("opens court documents on justice.cz in a new tab", () => {
    render(<DocumentList />);
    const external = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.includes("justice.cz"));
    expect(external).toHaveLength(3);
    for (const link of external) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("marks only the směrnice as a draft", () => {
    render(<DocumentList />);
    const drafts = screen.getAllByText("Návrh");
    expect(drafts).toHaveLength(1);
    expect(drafts[0].closest("li")).toHaveTextContent("Směrnice o rozhodování o výdajích");
  });

  it("shows the society identity", () => {
    render(<DocumentList />);
    expect(screen.getByText(/231 52 036/)).toBeInTheDocument();
  });
});

describe("SmerniceView", () => {
  it("renders the six articles and the draft label", () => {
    render(<SmerniceView />);
    for (const article of SMERNICE_ARTICLES) {
      expect(screen.getByRole("heading", { name: `Čl. ${article.number} · ${article.title}` })).toBeInTheDocument();
    }
    expect(screen.getByText(SMERNICE_DRAFT_LABEL)).toBeInTheDocument();
  });
});
