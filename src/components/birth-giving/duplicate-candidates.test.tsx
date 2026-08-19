import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingDuplicateCandidates } from "@/components/birth-giving/duplicate-candidates";

describe("BirthGivingDuplicateCandidates", () => {
  const candidates = [
    { id: "event-1", name: "First BG", customer: "Zákazník A", starts_at: "2026-08-19T08:00:00.000Z", status: "published" as const },
    { id: "event-2", name: "Second BG", customer: "Zákazník A", starts_at: "2026-08-18T08:00:00.000Z", status: "draft" as const },
  ];

  it("renders every candidate with a warning, a date, and a link", () => {
    render(<BirthGivingDuplicateCandidates candidates={candidates} />);

    expect(screen.getByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText("Second BG")).toBeInTheDocument();
    expect(screen.getAllByText("Zákazník A").length).toBe(2);
    expect(screen.getByText("19. 8. 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First BG/ })).toHaveAttribute(
      "href",
      "/birth-giving/event-1",
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Zveřejněná")).toBeInTheDocument();
  });

  it("renders nothing when there are no candidates", () => {
    render(<BirthGivingDuplicateCandidates candidates={[]} />);
    expect(screen.queryByText("Podobná událost už existuje")).not.toBeInTheDocument();
  });
});