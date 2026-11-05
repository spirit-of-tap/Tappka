import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NextTrainingSessionCard } from "./next-training-session-card";

const session = {
  id: "session-1",
  topic: "Strategická session",
  starts_at: "2026-11-04T10:00:00+01:00",
  ends_at: "2026-11-04T11:30:00+01:00",
  location: "A123",
  team: { name: "Alpha", color: "#3366ff" },
  facilitators: [{ profile: { name: "Jana Nováková" } }],
  isCross: true,
};

describe("NextTrainingSessionCard", () => {
  it("shows the next session with time, team, location and facilitator", () => {
    render(<NextTrainingSessionCard session={session} />);

    expect(screen.getByText("Nejbližší training session")).toBeInTheDocument();
    expect(screen.getByText("Strategická session")).toBeInTheDocument();
    expect(screen.getByText(/4\. listopadu/)).toBeInTheDocument();
    expect(screen.getByText(/10:00–11:30/)).toBeInTheDocument();
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/A123/)).toBeInTheDocument();
    expect(screen.getByText(/Jana Nováková/)).toBeInTheDocument();
    expect(screen.getByText("Cross")).toBeInTheDocument();
  });

  it("links the card to the session detail and the header to all sessions", () => {
    render(<NextTrainingSessionCard session={session} />);

    expect(screen.getByRole("link", { name: /Strategická session/ })).toHaveAttribute(
      "href",
      "/ts/session-1",
    );
    expect(screen.getByRole("link", { name: /Všechny TS/ })).toHaveAttribute(
      "href",
      "/ts/prehled",
    );
  });

  it("shows an exploration empty state when nothing is scheduled", () => {
    render(<NextTrainingSessionCard session={null} />);

    expect(screen.getByText("Nemáš naplánovanou žádnou training session.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Objevovat TS" })).toHaveAttribute(
      "href",
      "/ts/objevovat",
    );
  });
});
