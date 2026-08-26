import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingEventCard } from "@/components/birth-giving/event-card";
import { makeEventIndexItem, NOW } from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingEventCard", () => {
  it("renders name, customer, start, duration and counts", () => {
    render(
      <BirthGivingEventCard
        event={makeEventIndexItem({ team_count: 3, participant_count: 7 })}
        now={NOW}
      />,
    );

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText("Zákazník A")).toBeInTheDocument();
    expect(screen.getByText("8 h")).toBeInTheDocument();
    expect(screen.getByText(/19\. 8\. 2026/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("links to the canonical event detail", () => {
    render(<BirthGivingEventCard event={makeEventIndexItem()} now={NOW} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/birth-giving/event-1",
    );
  });
});