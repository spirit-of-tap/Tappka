import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingReflectionList } from "@/components/birth-giving/reflection-list";
import {
  makeEvent,
  makeMemberWithProfile,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";

describe("BirthGivingReflectionList", () => {
  it("renders every member reflection with its owner", () => {
    const team = makeTeam({
      members: [
        makeMemberWithProfile({
          profile_id: "member-1",
          reflection_contribution: "Převzal jsem komunikaci se zákazníkem.",
          reflection_learning: "Naučil jsem se psát stručné zápisy.",
        }),
        makeMemberWithProfile({
          profile_id: "candidate-2",
          reflection_contribution: "Moderovala jsem diskuze.",
          reflection_learning: "Zlepšila jsem naslouchání.",
        }),
      ],
    });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="viewer-1" onEventChange={vi.fn()} />);

    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.getByText("Převzal jsem komunikaci se zákazníkem.")).toBeInTheDocument();
    expect(screen.getByText("Naučil jsem se psát stručné zápisy.")).toBeInTheDocument();
    expect(screen.getByText("Member candidate-2")).toBeInTheDocument();
    expect(screen.getByText("Moderovala jsem diskuze.")).toBeInTheDocument();
  });
});