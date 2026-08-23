import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamSnapshotCard } from "@/components/dashboard/team-snapshot-card";

describe("TeamSnapshotCard", () => {
  const stats = [
    {
      profile: { id: "p1", name: "Anna Nováková", picture: null },
      approved_points: 30,
      pending_points: 0,
    },
    {
      profile: { id: "p2", name: "Bohuš Dvořák", picture: null },
      approved_points: 50,
      pending_points: 2,
    },
    {
      profile: { id: "p3", name: "Cyril Hrubý", picture: null },
      approved_points: 10,
      pending_points: 0,
    },
    {
      profile: { id: "p4", name: "Dana Malá", picture: null },
      approved_points: 5,
      pending_points: 0,
    },
  ];

  it("renders the team name in the title", () => {
    render(<TeamSnapshotCard stats={stats} hasTeam teamName="Ambiciózní" />);
    expect(screen.getByText("Tým Ambiciózní")).toBeInTheDocument();
  });

  it("links to the full team leaderboard", () => {
    render(<TeamSnapshotCard stats={stats} hasTeam teamName="Ambiciózní" />);
    expect(screen.getByRole("link", { name: /Celý tým/ })).toHaveAttribute(
      "href",
      "/cteni/prehled",
    );
  });

  it("shows the top three readers by approved points, highest first", () => {
    render(<TeamSnapshotCard stats={stats} hasTeam />);
    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent ?? "")
      .filter((text) => !text.includes("Celý tým"));
    expect(names[0]).toContain("Bohuš Dvořák");
    expect(names[1]).toContain("Anna Nováková");
    expect(names[2]).toContain("Cyril Hrubý");
    expect(screen.queryByText("Dana Malá")).not.toBeInTheDocument();
  });

  it("links each leaderboard row to that member's profile", () => {
    render(<TeamSnapshotCard stats={stats} hasTeam />);
    expect(screen.getByRole("link", { name: /Bohuš Dvořák/ })).toHaveAttribute(
      "href",
      "/komunita/profil/p2",
    );
    expect(screen.getByRole("link", { name: /Anna Nováková/ })).toHaveAttribute(
      "href",
      "/komunita/profil/p1",
    );
    expect(screen.getByRole("link", { name: /Cyril Hrubý/ })).toHaveAttribute(
      "href",
      "/komunita/profil/p3",
    );
  });

  it("keeps the rank and points inside the row link", () => {
    render(<TeamSnapshotCard stats={stats} hasTeam />);
    const topRow = screen.getByRole("link", { name: /Bohuš Dvořák/ });
    expect(topRow.textContent).toContain("1.");
    expect(topRow.textContent).toContain("50 b.");
  });

  it("shows a hint instead of the leaderboard when the user has no team", () => {
    render(<TeamSnapshotCard stats={[]} hasTeam={false} />);
    expect(screen.getByText("Nemáš přiřazený tým.")).toBeInTheDocument();
  });

  it("shows an empty state when the team has no points yet", () => {
    render(<TeamSnapshotCard stats={[]} hasTeam />);
    expect(screen.getByText("Tým zatím nemá žádné body.")).toBeInTheDocument();
  });
});
