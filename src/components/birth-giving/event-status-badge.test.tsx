import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingEventStatusBadge } from "@/components/birth-giving/event-status-badge";

describe("BirthGivingEventStatusBadge", () => {
  it("shows open joining for an upcoming event", () => {
    render(
      <BirthGivingEventStatusBadge joiningOpen timeState="upcoming" />,
    );
    expect(screen.getByText("Přihlašování otevřeno")).toBeInTheDocument();
    expect(screen.queryByText("Přihlašování zavřeno")).not.toBeInTheDocument();
  });

  it("shows closed joining for an upcoming event", () => {
    render(
      <BirthGivingEventStatusBadge joiningOpen={false} timeState="upcoming" />,
    );
    expect(screen.getByText("Přihlašování zavřeno")).toBeInTheDocument();
  });

  it("marks an active event as running", () => {
    render(
      <BirthGivingEventStatusBadge joiningOpen={false} timeState="active" />,
    );
    expect(screen.getByText("Probíhá")).toBeInTheDocument();
  });

  it("marks an ended event as finished", () => {
    render(
      <BirthGivingEventStatusBadge joiningOpen timeState="ended" />,
    );
    expect(screen.getByText("Ukončeno")).toBeInTheDocument();
  });
});