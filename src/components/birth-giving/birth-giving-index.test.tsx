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
  participant_profile_ids: ["user-1"],
  teams: [
    {
      id: "team-1",
      name: "Tým Alfa",
      members: [
        {
          profile_id: "user-1",
          reflection_contribution: "Navrhl:a jsem frontend.",
          reflection_learning: "Naučil:a jsem se lépe pracovat s časem.",
        },
      ],
    },
  ],
});

const upcoming2 = makeEventIndexItem({
  id: "upcoming-2",
  name: "Podzimní BG",
  customer: "Zákazník Beta",
  starts_at: "2026-09-10T08:00:00.000Z",
  organizer_profile_ids: ["user-1"],
});

const past = makeEventIndexItem({
  id: "past-event",
  name: "Jarní BG",
  customer: "Zákazník Gama",
  starts_at: "2026-06-01T08:00:00.000Z",
});

const todayEvent = makeEventIndexItem({
  id: "today-event",
  name: "Dnešní Hackathon",
  customer: "Inovace s.r.o.",
  starts_at: "2026-08-19T08:00:00.000Z",
  duration: "24h",
  participant_profile_ids: ["user-1"],
  teams: [
    {
      id: "team-today",
      name: "Rychlíci",
      members: [{ profile_id: "user-1", reflection_contribution: null, reflection_learning: null }],
    },
  ],
});

describe("BirthGivingIndex", () => {
  it("renders all events and filter badge triggers", () => {
    render(
      <BirthGivingIndex
        events={[upcoming1, upcoming2, past]}
        profileId="user-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByRole("button", { name: /Všechny/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zúčastnil:a jsem se/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pořádal:a jsem/ })).toBeInTheDocument();

    expect(screen.getByText("Letní BG")).toBeInTheDocument();
    expect(screen.getByText("Podzimní BG")).toBeInTheDocument();
    expect(screen.getByText("Jarní BG")).toBeInTheDocument();
  });

  it("filters to only events I participated in", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingIndex
        events={[upcoming1, upcoming2, past]}
        profileId="user-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Zúčastnil:a jsem se/ }));

    expect(screen.getByText("Letní BG")).toBeInTheDocument();
    expect(screen.queryByText("Podzimní BG")).not.toBeInTheDocument();
    expect(screen.queryByText("Jarní BG")).not.toBeInTheDocument();
  });

  it("filters to only events I organized", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingIndex
        events={[upcoming1, upcoming2, past]}
        profileId="user-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Pořádal:a jsem/ }));

    expect(screen.getByText("Podzimní BG")).toBeInTheDocument();
    expect(screen.queryByText("Letní BG")).not.toBeInTheDocument();
    expect(screen.queryByText("Jarní BG")).not.toBeInTheDocument();
  });

  it("pins and highlights today/active event in the events list", () => {
    render(
      <BirthGivingIndex
        events={[upcoming1, todayEvent]}
        profileId="user-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByText("Dnešní Hackathon")).toBeInTheDocument();
    expect(screen.getByText("Právě probíhá")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dnešní Hackathon/ })).toHaveAttribute(
      "href",
      "/birth-giving/today-event",
    );
  });
});