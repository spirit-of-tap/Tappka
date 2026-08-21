import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingLookingForTeamList } from "@/components/birth-giving/looking-for-team-list";
import {
  makeEvent,
  makeMemberWithProfile,
  makeTeam,
  makeTeamSearch,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingLookingForTeamList", () => {
  it("lists every profile currently looking for a team", () => {
    const event = makeEvent(
      { starts_at: "2026-08-20T08:00:00.000Z" },
      { teamSearches: [makeTeamSearch("candidate-1", "Candidate One")] },
    );

    render(
      <BirthGivingLookingForTeamList event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Candidate One")).toBeInTheDocument();
    expect(screen.getByText("Hledají tým")).toBeInTheDocument();
  });

  it("renders the empty state with the shared Empty primitive", () => {
    const event = makeEvent({ starts_at: "2026-08-20T08:00:00.000Z" }, { teamSearches: [] });

    render(
      <BirthGivingLookingForTeamList event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    const empty = screen.getByText("Nikdo zatím nehledá tým.");
    expect(empty.closest('[data-slot="empty"]')).not.toBeNull();
    expect(empty.tagName.toLowerCase()).not.toBe("p");
  });

  it("lets a memberless profile start searching", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const onEventChange = vi.fn();
    const event = makeEvent({ starts_at: "2026-08-20T08:00:00.000Z" }, { teamSearches: [] });

    render(
      <BirthGivingLookingForTeamList event={event} profileId="member-1" now={NOW} onEventChange={onEventChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Hledám tým" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/looking-for-team",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ looking: true }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("lets a searching profile stop searching", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const onEventChange = vi.fn();
    const event = makeEvent(
      { starts_at: "2026-08-20T08:00:00.000Z" },
      { teamSearches: [makeTeamSearch("member-1", "Member One")] },
    );

    render(
      <BirthGivingLookingForTeamList event={event} profileId="member-1" now={NOW} onEventChange={onEventChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Zrušit hledání" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/looking-for-team",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("hides the toggle for a profile already in a team", () => {
    const team = makeTeam({ members: [makeMemberWithProfile({ profile_id: "member-1" })] });
    const event = makeEvent({ teams: [team] }, { teamSearches: [] });

    render(
      <BirthGivingLookingForTeamList event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: "Hledám tým" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zrušit hledání" })).not.toBeInTheDocument();
  });
});