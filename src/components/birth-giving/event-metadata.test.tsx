import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingEventMetadata } from "@/components/birth-giving/event-metadata";
import { makeEvent, makeOrganizerSummaries, NOW } from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingEventMetadata", () => {
  it("shows the shared event fields", () => {
    const event = makeEvent();
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText("Zákazník A")).toBeInTheDocument();
    expect(screen.getByText(/19\. 8\. 2026/)).toBeInTheDocument();
    expect(screen.getByText("8 h")).toBeInTheDocument();
    expect(screen.getByText("2–4")).toBeInTheDocument();
    expect(screen.getByText("Org One")).toBeInTheDocument();
  });

  it("hides the edit action for a non-organizer", () => {
    const event = makeEvent();
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Upravit událost" })).not.toBeInTheDocument();
  });

  it("opens a prefilled edit dialog for an organizer before the end", async () => {
    const user = userEvent.setup();
    const event = makeEvent({ name: "Stará událost" });
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Upravit událost" }));

    const nameInput = await screen.findByLabelText("Název události");
    expect(nameInput).toHaveValue("Stará událost");
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeInTheDocument();
  });
});