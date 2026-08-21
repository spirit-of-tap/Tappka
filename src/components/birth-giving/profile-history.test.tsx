import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { BirthGivingProfileHistory } from "@/components/birth-giving/profile-history";
import { makeHistoryItem, makeMember, makeOrganizer } from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingProfileHistory", () => {
  it("renders valid participations grouped by year with links, teams, customers, dates, durations and organizers", () => {
    render(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({
            id: "event-1",
            name: "First BG",
            customer: "Zákazník A",
            starts_at: "2026-08-19T08:00:00.000Z",
            duration: "8h",
            team: { id: "team-1", name: "Tým Alfa", status: "confirmed" },
            organizers: [makeOrganizer("org-1", "Org One")],
          }),
          makeHistoryItem({
            id: "event-2",
            name: "Second BG",
            customer: "Zákazník B",
            starts_at: "2024-06-01T08:00:00.000Z",
            duration: "24h",
            team: { id: "team-2", name: "Tým Beta", status: "confirmed" },
            organizers: [makeOrganizer("org-2", "Org Two")],
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["2026", "2024"]);
    expect(screen.getByRole("heading", { name: "2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2024" })).toBeInTheDocument();

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText(/Zákazník A/)).toBeInTheDocument();
    expect(screen.getByText(/Tým Alfa/)).toBeInTheDocument();
    expect(screen.getByText(/19\. srpna 2026/)).toBeInTheDocument();
    expect(screen.getByText(/8 h/)).toBeInTheDocument();
    expect(screen.getByText(/Organizátor:ky Org One/)).toBeInTheDocument();

    expect(screen.getByText("Second BG")).toBeInTheDocument();
    expect(screen.getByText(/Zákazník B/)).toBeInTheDocument();
    expect(screen.getByText(/Tým Beta/)).toBeInTheDocument();
    expect(screen.getByText(/1\. června 2024/)).toBeInTheDocument();
    expect(screen.getByText(/24 h/)).toBeInTheDocument();
    expect(screen.getByText(/Organizátor:ky Org Two/)).toBeInTheDocument();

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/birth-giving/event-1",
      "/birth-giving/event-2",
    ]);
  });

  it("groups participations by year, newest first, with per-year counts", () => {
    render(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({ id: "old", name: "Old BG", starts_at: "2023-05-01T08:00:00.000Z" }),
          makeHistoryItem({ id: "newer", name: "Newer BG", starts_at: "2025-05-01T08:00:00.000Z" }),
          makeHistoryItem({ id: "newest-a", name: "Newest A", starts_at: "2026-08-19T08:00:00.000Z" }),
          makeHistoryItem({ id: "newest-b", name: "Newest B", starts_at: "2026-03-01T08:00:00.000Z" }),
        ]}
      />,
    );

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["2026", "2025", "2023"]);

    const section2026 = screen.getByRole("heading", { name: "2026" }).closest("section");
    expect(section2026).not.toBeNull();
    expect(within(section2026!).getByText("2")).toBeInTheDocument();

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/birth-giving/newest-a",
      "/birth-giving/newest-b",
      "/birth-giving/newer",
      "/birth-giving/old",
    ]);
  });

  it("excludes participations in cancelled teams", () => {
    render(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({ id: "valid", name: "Valid BG" }),
          makeHistoryItem({
            id: "cancelled",
            name: "Cancelled BG",
            team: { id: "team-2", name: "Zrušený tým", status: "cancelled" },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Valid BG")).toBeInTheDocument();
    expect(screen.queryByText("Cancelled BG")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/birth-giving/valid"]);
  });

  it("excludes participations added after processing without a frozen membership", () => {
    render(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({ id: "valid", name: "Valid BG" }),
          makeHistoryItem({ id: "late", name: "Late BG", membership: makeMember({ frozen_at: null }) }),
        ]}
      />,
    );

    expect(screen.getByText("Valid BG")).toBeInTheDocument();
    expect(screen.queryByText("Late BG")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/birth-giving/valid"]);
  });

  it("shows an empty state with no items or when every participation is invalid", () => {
    const { rerender } = render(<BirthGivingProfileHistory items={[]} />);
    expect(screen.getByText("Žádná absolvovaná participace")).toBeInTheDocument();

    rerender(
      <BirthGivingProfileHistory
        items={[
          makeHistoryItem({
            id: "cancelled",
            name: "Cancelled BG",
            team: { id: "team-2", name: "Zrušený tým", status: "cancelled" },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Žádná absolvovaná participace")).toBeInTheDocument();
  });
});