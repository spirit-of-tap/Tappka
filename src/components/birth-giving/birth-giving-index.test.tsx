import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingIndex } from "@/components/birth-giving/birth-giving-index";
import { makeEventIndexItem, makeOrganizerSummaries } from "@/tests/component/birth-giving-fixtures";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push }),
}));

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
  push.mockReset();
});

const NOW = "2026-08-19T12:00:00.000Z";

const upcoming1 = makeEventIndexItem({
  id: "upcoming-1",
  name: "Letní BG",
  customer: "Zákazník Alfa",
  starts_at: "2026-09-01T08:00:00.000Z",
  organizer_profile_ids: ["org-1"],
  team_count: 1,
  participant_count: 2,
});

const upcoming2 = makeEventIndexItem({
  id: "upcoming-2",
  name: "Podzimní BG",
  customer: "Zákazník Beta",
  starts_at: "2026-09-10T08:00:00.000Z",
});

const past = makeEventIndexItem({
  id: "past-event",
  name: "Jarní BG",
  customer: "Zákazník Gama",
  starts_at: "2026-06-01T08:00:00.000Z",
});

describe("BirthGivingIndex", () => {
  it("groups events into the right tabs and shows counts", () => {
    render(
      <BirthGivingIndex
        events={[upcoming1, upcoming2, past]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByRole("tab", { name: /Nadcházející/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Moje/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Historie/ })).toBeInTheDocument();

    expect(screen.getByText("Letní BG")).toBeInTheDocument();
    expect(screen.getByText("Podzimní BG")).toBeInTheDocument();
    expect(screen.queryByText("Jarní BG")).not.toBeInTheDocument();
  });

  it("switches to the history tab on demand", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingIndex
        events={[upcoming1, past]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Historie/ }));

    expect(screen.getByText("Jarní BG")).toBeInTheDocument();
    expect(screen.queryByText("Letní BG")).not.toBeInTheDocument();
  });

  it("shows my events", () => {
    render(
      <BirthGivingIndex
        events={[
          makeEventIndexItem({
            id: "mine-draft",
            name: "Můj event",
            starts_at: "2026-09-20T08:00:00.000Z",
            participant_profile_ids: ["me-1"],
          }),
        ]}
        profileId="me-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByText("Můj event")).toBeInTheDocument();
  });
});