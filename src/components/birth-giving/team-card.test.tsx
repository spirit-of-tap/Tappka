import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingTeamCard } from "@/components/birth-giving/team-card";
import {
  makeAllProfiles,
  makeEvent,
  makeMemberWithProfile,
  makeResultFile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

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
});