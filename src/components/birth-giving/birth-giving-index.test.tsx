import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingIndex } from "@/components/birth-giving/birth-giving-index";
import { makeEvent, makeEventIndexItem, makeOrganizerSummaries } from "@/tests/component/birth-giving-fixtures";

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

const upcomingOpen = makeEventIndexItem({
  id: "upcoming-open",
  name: "Letní BG",
  customer: "Zákazník Alfa",
  starts_at: "2026-09-01T08:00:00.000Z",
  joining_open: true,
  organizer_profile_ids: ["org-1"],
  team_count: 1,
  participant_count: 2,
});

const upcomingClosed = makeEventIndexItem({
  id: "upcoming-closed",
  name: "Podzimní BG",
  customer: "Zákazník Beta",
  starts_at: "2026-09-10T08:00:00.000Z",
  joining_open: false,
});

const past = makeEventIndexItem({
  id: "past-event",
  name: "Jarní BG",
  customer: "Zákazník Gama",
  starts_at: "2026-06-01T08:00:00.000Z",
  joining_open: false,
});

describe("BirthGivingIndex", () => {
  it("groups events into the right tabs and shows counts", () => {
    render(
      <BirthGivingIndex
        events={[upcomingOpen, upcomingClosed, past]}
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
        events={[upcomingOpen, past]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Historie/ }));

    expect(screen.getByText("Jarní BG")).toBeInTheDocument();
    expect(screen.queryByText("Letní BG")).not.toBeInTheDocument();
  });

  it("shows my events including pending proposals", () => {
    render(
      <BirthGivingIndex
        events={[
          makeEventIndexItem({
            id: "mine-draft",
            name: "Můj event",
            starts_at: "2026-09-20T08:00:00.000Z",
            joining_open: true,
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

  it("filters by event name case-insensitively", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingIndex
        events={[upcomingOpen, upcomingClosed]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.type(screen.getByLabelText("Hledat událost"), "letni");

    expect(screen.getByText("Letní BG")).toBeInTheDocument();
    expect(screen.queryByText("Podzimní BG")).not.toBeInTheDocument();
  });

  it("filters by customer without diacritics", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingIndex
        events={[upcomingOpen, upcomingClosed]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.type(screen.getByLabelText("Hledat událost"), "zakaznik beta");

    expect(screen.getByText("Podzimní BG")).toBeInTheDocument();
    expect(screen.queryByText("Letní BG")).not.toBeInTheDocument();
  });

  it("shows an empty state when a tab has no events", () => {
    render(
      <BirthGivingIndex
        events={[]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByText("Žádné nadcházející události")).toBeInTheDocument();
  });

  it("routes to the created draft so completion is never a dead end", async () => {
    const user = userEvent.setup();
    const draft = makeEvent({ id: "draft-1", status: "draft", name: "Nový BG" });
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: draft }),
      } as Response);

    render(
      <BirthGivingIndex
        events={[]}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Nová událost" }));
    await user.type(await screen.findByLabelText("Název události"), "Nový BG");
    await user.type(screen.getByLabelText("Zákazník"), "Zákazník A");
    await user.type(screen.getByLabelText("Začátek"), "2026-08-20T08:00");
    const minInput = screen.getByLabelText("Min. velikost týmu") as HTMLInputElement;
    const maxInput = screen.getByLabelText("Max. velikost týmu") as HTMLInputElement;
    await user.clear(minInput);
    await user.type(minInput, "2");
    await user.clear(maxInput);
    await user.type(maxInput, "4");
    await user.click(screen.getByRole("button", { name: "Vytvořit událost" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/birth-giving/draft-1"));
  });
});