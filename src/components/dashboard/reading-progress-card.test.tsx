import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadingProgressCard } from "@/components/dashboard/reading-progress-card";

describe("ReadingProgressCard", () => {
  const stats = { approved_points: 30, pending_points: 5, essay_count: 2 };

  it("renders the card with essay count", () => {
    render(<ReadingProgressCard stats={stats} />);
    expect(screen.getByText("Čtení")).toBeInTheDocument();
    expect(screen.getByText(/2 eseje/)).toBeInTheDocument();
  });

  it("shows pending books message when pending_points > 0", () => {
    render(<ReadingProgressCard stats={stats} />);
    expect(screen.getByText(/5 knih čeká/)).toBeInTheDocument();
  });

  it("shows singular pending text for 1 pending point", () => {
    render(<ReadingProgressCard stats={{ approved_points: 0, pending_points: 1, essay_count: 0 }} />);
    expect(screen.getByText(/1 kniha čeká/)).toBeInTheDocument();
  });

  it("shows 'žádné eseje' when essay_count is 0", () => {
    render(<ReadingProgressCard stats={{ approved_points: 0, pending_points: 0, essay_count: 0 }} />);
    expect(screen.getByText("Zatím žádné eseje")).toBeInTheDocument();
  });

  it("renders a link to /cteni/prehled", () => {
    render(<ReadingProgressCard stats={stats} />);
    const link = screen.getByRole("link", { name: /Přehled/ });
    expect(link).toHaveAttribute("href", "/cteni/prehled");
  });

  it("renders the config-derived progress strip", () => {
    render(
      <ReadingProgressCard
        stats={{ approved_points: 50, pending_points: 0, essay_count: 0, approved_points_this_semester: 10 }}
      />,
    );
    // Goals come from METRICS["knizni-body"]: 20 per semester, 120 per study.
    expect(screen.getByText("50/120")).toBeInTheDocument();
    expect(screen.getByText(/za studium/)).toBeInTheDocument();
    expect(screen.getByText("10/20")).toBeInTheDocument();
    expect(screen.getByText(/tento semestr/)).toBeInTheDocument();
  });
});
