import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingEventDetail } from "@/components/birth-giving/event-detail";
import {
  makeAllProfiles,
  makeEvent,
  makeMemberWithProfile,
  makeResultFile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/birth-giving/event-1",
}));

beforeEach(() => {
  fetchSpy.mockReset();
  refresh.mockReset();
});

function renderDetail({
  event = makeEvent({
    starts_at: "2026-08-20T08:00:00.000Z",
    teams: [
      makeTeam({
        members: [makeMemberWithProfile()],
        result_files: [makeResultFile()],
      }),
    ],
  }),
  profileId = "member-1",
} = {}) {
  render(
    <BirthGivingEventDetail
      event={event}
      profileId={profileId}
      organizerProfiles={makeAllProfiles()}
      now={NOW}
    />,
  );
}

describe("BirthGivingEventDetail", () => {
  it("renders the canonical event detail sections", () => {
    renderDetail();

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText("Tým Alfa")).toBeInTheDocument();
    expect(screen.getByText("Zadání")).toBeInTheDocument();
  });

  it("applies a refreshed event from a mutation response without a router refresh", async () => {
    const user = userEvent.setup();
    const refreshed = makeEvent({
      teams: [
        makeTeam({ id: "team-2", name: "Tým Beta", members: [makeMemberWithProfile()] }),
      ],
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: refreshed }),
    } as Response);
    renderDetail();

    await user.click(screen.getByRole("button", { name: "Vytvořit tým" }));
    await user.type(await screen.findByLabelText("Název týmu"), "Tým Beta");
    await user.click(screen.getByRole("button", { name: "Vytvořit tým" }));

    expect(await screen.findByText("Tým Beta")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});