import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingProfileHistory } from "@/components/birth-giving/profile-history";
import { makeHistoryItem } from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingProfileHistory", () => {
  it("renders each event with its team and links to the canonical detail", () => {
    render(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({ id: "event-1", name: "First BG", team: { id: "team-1", name: "Tým Alfa", status: "confirmed" } }),
          makeHistoryItem({
            id: "event-2",
            name: "Second BG",
            customer: "Zákazník B",
            starts_at: "2026-07-01T08:00:00.000Z",
            team: { id: "team-2", name: "Tým Beta", status: "confirmed" },
          }),
        ]}
      />,
    );

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText(/Zákazník A/)).toBeInTheDocument();
    expect(screen.getByText(/Tým Alfa/)).toBeInTheDocument();
    expect(screen.getByText("Second BG")).toBeInTheDocument();
    expect(screen.getByText(/Tým Beta/)).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
      ["/birth-giving/event-1", "/birth-giving/event-2"],
    );
  });

  it("shows an empty state without items", () => {
    render(<BirthGivingProfileHistory items={[]} />);
    expect(screen.getByText("Žádná absolvovaná participace")).toBeInTheDocument();
  });
});