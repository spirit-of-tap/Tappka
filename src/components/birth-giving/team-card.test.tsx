import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingTeamCard } from "@/components/birth-giving/team-card";
import {
  makeAllProfiles,
  makeEvent,
  makeMemberWithProfile,
  makeProposal,
  makeReflection,
  makeResultFile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingTeamCard", () => {
  it("shows team name, status, capacity and members", () => {
    const team = makeTeam({
      status: "confirmed",
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
    expect(screen.getByText("Potvrzený")).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.getByText("Member candidate-2")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
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

  it("renders pending proposals with directional labels", () => {
    const team = makeTeam({
      members: [makeMemberWithProfile({ profile_id: "member-1" })],
      proposals: [
        makeProposal({ direction: "join_request", candidate_profile_id: "candidate-1" }),
      ],
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

    expect(screen.getByText(/Candidate candidate-1/)).toBeInTheDocument();
    expect(screen.getByText(/Žádost o vstup/)).toBeInTheDocument();
  });

  it("shows a cancelled team with its reason and no actions", () => {
    const team = makeTeam({
      id: "team-2",
      name: "Vyřazený tým",
      status: "cancelled",
      cancelled_at: "2026-08-19T08:00:00.000Z",
      cancellation_reason: "Nenaplnil se minimální počet",
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

    expect(screen.getByText("Zrušený")).toBeInTheDocument();
    expect(screen.getByText("Nenaplnil se minimální počet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Požádat o vstup" })).not.toBeInTheDocument();
  });

  it("surfaces the team result files and member reflections", () => {
    const team = makeTeam({
      members: [
        makeMemberWithProfile(
          { profile_id: "member-1" },
          makeReflection({ contribution: "Přínos člena." }),
        ),
      ],
      result_files: [makeResultFile({ original_file_name: "vysledky.pdf" })],
      status: "confirmed",
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
});