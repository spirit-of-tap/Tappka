import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingReflectionList } from "@/components/birth-giving/reflection-list";
import {
  makeEvent,
  makeMemberWithProfile,
  makeReflection,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingReflectionList", () => {
  it("renders every member reflection with its owner", () => {
    const team = makeTeam({
      members: [
        makeMemberWithProfile(
          { profile_id: "member-1" },
          makeReflection({
            contribution: "Převzal jsem komunikaci se zákazníkem.",
            learning: "Naučil jsem se psát stručné zápisy.",
          }),
        ),
        makeMemberWithProfile({ profile_id: "candidate-2" }, makeReflection({
          id: "reflection-2",
          profile_id: "candidate-2",
          contribution: "Moderovala jsem diskuze.",
          learning: "Zlepšila jsem naslouchání.",
        })),
      ],
    });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="viewer-1" onEventChange={vi.fn()} />);

    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.getByText("Převzal jsem komunikaci se zákazníkem.")).toBeInTheDocument();
    expect(screen.getByText("Naučil jsem se psát stručné zápisy.")).toBeInTheDocument();
    expect(screen.getByText("Member candidate-2")).toBeInTheDocument();
    expect(screen.getByText("Moderovala jsem diskuze.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upravit reflexi" })).not.toBeInTheDocument();
  });

  it("lets the owner edit their own reflection", async () => {
    const user = userEvent.setup();
    const refreshed = makeEvent();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: refreshed }),
    } as Response);
    const onEventChange = vi.fn();
    const team = makeTeam({
      members: [
        makeMemberWithProfile(
          { profile_id: "member-1" },
          makeReflection({ contribution: "Staré přínosy.", learning: "Staré poučení." }),
        ),
      ],
    });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="member-1" onEventChange={onEventChange} />);
    await user.click(screen.getByRole("button", { name: "Upravit reflexi" }));

    const contribution = screen.getByLabelText("Přínos");
    const learning = screen.getByLabelText("Poučení");
    expect((contribution as HTMLTextAreaElement).value).toBe("Staré přínosy.");
    expect((learning as HTMLTextAreaElement).value).toBe("Staré poučení.");

    await user.clear(contribution);
    await user.type(contribution, "Nové přínosy.");
    await user.click(screen.getByRole("button", { name: "Uložit reflexi" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/reflection",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ contribution: "Nové přínosy.", learning: "Staré poučení." }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(refreshed));
  });

  it("offers a member without a reflection to add one", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const onEventChange = vi.fn();
    const team = makeTeam({
      members: [makeMemberWithProfile({ profile_id: "member-1" }, null)],
    });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="member-1" onEventChange={onEventChange} />);
    await user.click(screen.getByRole("button", { name: "Přidat reflexi" }));

    await user.type(screen.getByLabelText("Přínos"), "Organizoval jsem tým.");
    await user.type(screen.getByLabelText("Poučení"), "Vyzkoušel jsem nový formát.");
    await user.click(screen.getByRole("button", { name: "Uložit reflexi" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/reflection",
        expect.objectContaining({
          body: JSON.stringify({ contribution: "Organizoval jsem tým.", learning: "Vyzkoušel jsem nový formát." }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("does not let a non-member add reflections", () => {
    const team = makeTeam({ members: [makeMemberWithProfile({ profile_id: "member-1" }, null)] });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="viewer-1" onEventChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Přidat reflexi" })).not.toBeInTheDocument();
  });

  it("shows a friendly empty note when nobody wrote a reflection yet", () => {
    const team = makeTeam({ members: [makeMemberWithProfile({ profile_id: "member-1" }, null)] });
    const event = makeEvent({ teams: [team] });

    render(<BirthGivingReflectionList event={event} team={team} profileId="viewer-1" onEventChange={vi.fn()} />);

    expect(screen.getByText("Zatím žádné reflexe")).toBeInTheDocument();
  });
});