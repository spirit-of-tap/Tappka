import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadingProgressCard } from "@/components/dashboard/reading-progress-card";

describe("ReadingProgressCard", () => {
  const stats = { approved_points: 30, pending_points: 5, essay_count: 2 };

  afterEach(() => {
    vi.useRealTimers();
  });

  function atSemester(date: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(date));
  }

  it("summarises essays and pending books", () => {
    render(<ReadingProgressCard stats={stats} />);
    expect(screen.getByText(/2 eseje · 5 knih čeká na schválení/)).toBeInTheDocument();
  });

  it("uses singular pending text for 1 pending point", () => {
    render(<ReadingProgressCard stats={{ approved_points: 0, pending_points: 1, essay_count: 0 }} />);
    expect(screen.getByText(/Zatím žádné eseje · 1 kniha čeká/)).toBeInTheDocument();
  });

  it("links to /cteni/prehled", () => {
    render(<ReadingProgressCard stats={stats} />);
    expect(screen.getByRole("link", { name: /Přehled/ })).toHaveAttribute("href", "/cteni/prehled");
  });

  it("measures points against the cumulative goal of the cohort's semester", () => {
    atSemester("2026-10-15T12:00:00");
    render(
      <ReadingProgressCard stats={{ approved_points: 7, pending_points: 0, essay_count: 4 }} onboardingYear={2025} />,
    );
    // Cohort 2025 is in its 3rd semester in October 2026: 3 × 20 b.
    expect(screen.getByText(/Čtení · 3\. semestr/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "7 z 60 knižních bodů" })).toBeInTheDocument();
    expect(screen.getByText("Zbývá 53 bodů")).toBeInTheDocument();
  });

  it("reports the surplus once the goal is met", () => {
    atSemester("2026-10-15T12:00:00");
    render(
      <ReadingProgressCard stats={{ approved_points: 25, pending_points: 0, essay_count: 5 }} onboardingYear={2026} />,
    );
    expect(screen.getByText("Cíl splněn (+5)")).toBeInTheDocument();
  });
});
