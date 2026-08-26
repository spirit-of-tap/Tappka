import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingTeamList } from "@/components/birth-giving/team-list";
import {
  makeAllProfiles,
  makeEvent,
  makeMemberWithProfile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingTeamList", () => {
  it("renders every team card", () => {
    const teams = [
      makeTeam({ id: "team-1", name: "Tým Alfa", members: [makeMemberWithProfile()] }),
      makeTeam({ id: "team-2", name: "Tým Beta", members: [makeMemberWithProfile({ profile_id: "candidate-2" })] }),
    ];
    const event = makeEvent({ teams });
    render(
      <BirthGivingTeamList event={event} profileId="member-1" now={NOW} organizerProfiles={makeAllProfiles()} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Tým Alfa")).toBeInTheDocument();
    expect(screen.getByText("Tým Beta")).toBeInTheDocument();
  });

  it("shows an empty state while the formation is open", () => {
    const event = makeEvent({ starts_at: "2026-08-20T08:00:00.000Z", teams: [] });
    render(
      <BirthGivingTeamList event={event} profileId="member-1" now={NOW} organizerProfiles={makeAllProfiles()} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zatím žádné týmy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vytvořit tým" })).toBeInTheDocument();
  });

  it("shows no teams description on published event with no teams", () => {
    const event = makeEvent({ starts_at: "2026-08-19T08:00:00.000Z", teams: [] });
    render(
      <BirthGivingTeamList event={event} profileId="member-1" now={NOW} organizerProfiles={makeAllProfiles()} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zatím žádné týmy")).toBeInTheDocument();
    expect(
      screen.getByText("Pro tuto událost nebyly založeny žádné týmy."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Týmy se zobrazí po zveřejnění.")).not.toBeInTheDocument();
  });

  it("keeps the draft explanation for a draft with no teams", () => {
    const event = makeEvent({ status: "draft", teams: [] });
    render(
      <BirthGivingTeamList event={event} profileId="org-1" now={NOW} organizerProfiles={makeAllProfiles()} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Týmy se zobrazí po zveřejnění.")).toBeInTheDocument();
  });
});