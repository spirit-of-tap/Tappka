import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingTeamCard } from "@/components/birth-giving/team-card";
import {
  makeAllProfiles,
  makeEvent,
  makeMemberWithProfile,
  makeResultFile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

function fetchSpy() {
  return vi.spyOn(globalThis, "fetch");
}

function jsonOk(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("BirthGivingTeamCard", () => {
  it("shows team name, members and winner badge", () => {
    const team = makeTeam({
      is_winner: true,
      members: [
        makeMemberWithProfile({ profile_id: "member-1" }),
        makeMemberWithProfile({ profile_id: "candidate-2" }),
      ],
    });
    const event = makeEvent({ teams: [team] });

    render(
      <BirthGivingTeamCard
        event={event}
        team={team}
        profileId="viewer-1"
        now={NOW}
        organizerProfiles={makeAllProfiles()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Tým Alfa")).toBeInTheDocument();
    expect(screen.getByText("Vítězný tým")).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.getByText("Member candidate-2")).toBeInTheDocument();
  });

  it("marks the current profile's team", () => {
    const team = makeTeam({
      members: [makeMemberWithProfile({ profile_id: "member-1" })],
    });
    const event = makeEvent({ teams: [team] });

    render(
      <BirthGivingTeamCard
        event={event}
        team={team}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeAllProfiles()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Můj tým")).toBeInTheDocument();
  });

  it("surfaces the team result files and member reflections", () => {
    const team = makeTeam({
      members: [
        makeMemberWithProfile({
          profile_id: "member-1",
          reflection_contribution: "Přínos člena.",
          reflection_learning: "Poučení člena.",
        }),
      ],
      result_files: [makeResultFile({ original_file_name: "vysledky.pdf" })],
    });
    const event = makeEvent({ teams: [team] });

    render(
      <BirthGivingTeamCard
        event={event}
        team={team}
        profileId="viewer-1"
        now={NOW}
        organizerProfiles={makeAllProfiles()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("vysledky.pdf")).toBeInTheDocument();
    expect(screen.getByText("Přínos člena.")).toBeInTheDocument();
  });

  it("toggles the winner through a single-encoded JSON body", async () => {
    const fetchMock = fetchSpy();
    fetchMock.mockResolvedValue(jsonOk({ data: null }));

    const team = makeTeam({
      is_winner: false,
      members: [makeMemberWithProfile({ profile_id: "member-1" })],
    });
    const event = makeEvent({ teams: [team] });
    const onEventChange = vi.fn();

    render(
      <BirthGivingTeamCard
        event={event}
        team={team}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeAllProfiles()}
        onEventChange={onEventChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Označit jako vítězný tým" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    // The body must be a single-encoded JSON object, not a quoted string.
    expect(JSON.parse(String(init.body))).toEqual({ isWinner: true });
    expect(init.body).not.toBe(JSON.stringify(JSON.stringify({ isWinner: true })));
  });
});