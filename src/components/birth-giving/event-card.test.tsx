import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingEventCard } from "@/components/birth-giving/event-card";
import { makeEventIndexItem, NOW, STARTS_AT } from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingEventCard", () => {
  it("renders name, customer, start, duration, range and counts", () => {
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
    expect(screen.getByText("2–4")).toBeInTheDocument();
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

  it("shows an open joining badge for an upcoming open event", () => {
    render(
      <BirthGivingEventCard
        event={makeEventIndexItem({ starts_at: "2026-09-01T08:00:00.000Z", joining_open: true })}
        now={NOW}
      />,
    );
    expect(screen.getByText("Přihlašování otevřeno")).toBeInTheDocument();
  });

  it("shows a closed badge for an upcoming event without open joining", () => {
    render(
      <BirthGivingEventCard
        event={makeEventIndexItem({ starts_at: "2026-09-01T08:00:00.000Z", joining_open: false })}
        now={NOW}
      />,
    );
    expect(screen.getByText("Přihlašování zavřeno")).toBeInTheDocument();
  });

  it("marks an event happening right now as running", () => {
    render(
      <BirthGivingEventCard
        event={makeEventIndexItem({ starts_at: STARTS_AT })}
        now={NOW}
      />,
    );
    expect(screen.getByText("Probíhá")).toBeInTheDocument();
  });

  it("marks a finished event as finished", () => {
    render(
      <BirthGivingEventCard
        event={makeEventIndexItem({ starts_at: "2026-08-10T08:00:00.000Z" })}
        now="2026-08-12T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("Ukončeno")).toBeInTheDocument();
  });
});