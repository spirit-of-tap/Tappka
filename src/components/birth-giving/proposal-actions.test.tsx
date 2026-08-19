import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingProposalActions } from "@/components/birth-giving/proposal-actions";
import {
  makeEvent,
  makeMemberWithProfile,
  makeProposal,
  makeTeam,
  makeAllProfiles,
  NOW,
} from "@/tests/component/birth-giving-fixtures";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

function renderActions(props: {
  event?: BirthGivingEventDetail;
  teamMember?: boolean;
  overrides?: Parameters<typeof makeTeam>[0];
}) {
  const team = makeTeam({
    members: props.teamMember ? [makeMemberWithProfile()] : [],
    ...props.overrides,
  });
  const event = props.event ?? makeEvent({ starts_at: "2026-08-20T08:00:00.000Z", teams: [team] });
  const onEventChange = vi.fn();
  render(
    <BirthGivingProposalActions
      event={event}
      team={team}
      profileId="member-1"
      profiles={makeAllProfiles()}
      now={NOW}
      onEventChange={onEventChange}
    />,
  );
  return { event, team, onEventChange };
}

describe("BirthGivingProposalActions", () => {
  it("lets a team member approve an incoming join request", async () => {
    const user = userEvent.setup();
    const refreshed = makeEvent();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: refreshed }),
    } as Response);
    const { onEventChange } = renderActions({
      teamMember: true,
      overrides: {
        proposals: [makeProposal({ candidate_profile_id: "candidate-1" })],
      },
    });

    await user.click(screen.getByRole("button", { name: "Přijmout" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/proposals/proposal-1/accept",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(refreshed));
  });

  it("lets a team member reject an incoming join request", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const { onEventChange } = renderActions({
      teamMember: true,
      overrides: {
        proposals: [makeProposal({ candidate_profile_id: "candidate-1" })],
      },
    });

    await user.click(screen.getByRole("button", { name: "Odmítnout" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/proposals/proposal-1/reject",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("lets the candidate accept an incoming invitation", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const { onEventChange } = renderActions({
      overrides: {
        proposals: [
          makeProposal({
            direction: "invitation",
            candidate_profile_id: "member-1",
            initiated_by_profile_id: "candidate-1",
          }),
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "Přijmout pozvánku" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/proposals/proposal-1/accept",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("shows a capacity conflict toast when a proposal is accepted too late", async () => {
    const user = userEvent.setup();
    const toastModule = await import("sonner");
    const errorSpy = vi
      .spyOn(toastModule.toast, "error")
      .mockImplementation(() => "");
    const refreshed = makeEvent();
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "TEAM_FULL",
        error: "Tým už dosáhl maximální kapacity.",
        data: refreshed,
      }),
    } as Response);
    const { onEventChange } = renderActions({
      teamMember: true,
      overrides: {
        proposals: [makeProposal({ candidate_profile_id: "candidate-1" })],
      },
    });

    await user.click(screen.getByRole("button", { name: "Přijmout" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Tým už dosáhl maximální kapacity."),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(refreshed));
  });

  it("shows a formation-closed conflict toast for a join request race", async () => {
    const user = userEvent.setup();
    const toastModule = await import("sonner");
    const errorSpy = vi
      .spyOn(toastModule.toast, "error")
      .mockImplementation(() => "");
    const refreshed = makeEvent();
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "FORMATION_CLOSED",
        error: "Sestavování týmů už není otevřené.",
        data: refreshed,
      }),
    } as Response);
    const { onEventChange } = renderActions({
      overrides: { proposals: [] },
    });

    await user.click(screen.getByRole("button", { name: "Požádat o vstup" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Sestavování týmů už není otevřené."),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(refreshed));
  });

  it("requests entry as a join request without acknowledging a move", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const { onEventChange } = renderActions({ overrides: { proposals: [] } });

    await user.click(screen.getByRole("button", { name: "Požádat o vstup" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/proposals",
        expect.objectContaining({
          body: JSON.stringify({
            teamId: "team-1",
            candidateProfileId: "member-1",
            direction: "join_request",
            acknowledgeMove: false,
          }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("asks for explicit acknowledgement before a move is created", async () => {
    const user = userEvent.setup();
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "MOVE_REQUIRES_ACKNOWLEDGEMENT",
          error: "Přesun z existujícího týmu vyžaduje výslovné potvrzení.",
          data: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "event-1" } }),
      } as Response);
    const { onEventChange } = renderActions({ overrides: { proposals: [] } });

    await user.click(screen.getByRole("button", { name: "Požádat o vstup" }));

    expect(
      await screen.findByText("Přesun z existujícího týmu vyžaduje výslovné potvrzení."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokračovat" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenLastCalledWith(
        "/api/birth-giving/events/event-1/proposals",
        expect.objectContaining({
          body: JSON.stringify({
            teamId: "team-1",
            candidateProfileId: "member-1",
            direction: "join_request",
            acknowledgeMove: true,
          }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("lets a team member invite a searched profile", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const { onEventChange } = renderActions({
      teamMember: true,
      overrides: { proposals: [] },
    });

    await user.click(screen.getByRole("button", { name: "Pozvat" }));
    await user.click(await screen.findByRole("button", { name: "Vybrat osobu pro pozvánku" }));
    await user.type(await screen.findByLabelText("Hledat profil"), "Candidate One");
    await user.click(await screen.findByText("Candidate One"));
    await user.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/proposals",
        expect.objectContaining({
          body: JSON.stringify({
            teamId: "team-1",
            candidateProfileId: "candidate-1",
            direction: "invitation",
            acknowledgeMove: false,
          }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("lets the initiator cancel a pending join request", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);
    const { onEventChange } = renderActions({
      overrides: {
        proposals: [
          makeProposal({
            initiated_by_profile_id: "member-1",
            candidate_profile_id: "member-1",
          }),
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "Zrušit žádost" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/proposals/proposal-1/cancel",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });
});