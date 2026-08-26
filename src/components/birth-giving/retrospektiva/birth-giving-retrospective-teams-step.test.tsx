import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingRetrospectiveTeamsStep } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-teams-step";
import {
  makeAllProfiles,
  makeDraftEvent,
  makeMemberWithProfile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

interface Init {
  method?: string;
  body?: string;
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(stub: (url: string, init: Init) => Response | Promise<Response>) {
  fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET") as string;
    return Promise.resolve(
      stub(url, {
        method,
        body: typeof init?.body === "string" ? init.body : undefined,
      }),
    );
  });
}

function eventWithTeam(
  teamOverrides: NonNullable<Parameters<typeof makeTeam>[0]> = {},
  eventOverrides: Partial<BirthGivingEventDetail> = {},
): BirthGivingEventDetail {
  return makeDraftEvent({
    teams: [
      makeTeam({
        id: "team-1",
        result_state: "present",
        result_files: [],
        members: [makeMemberWithProfile()],
        ...teamOverrides,
      }),
    ],
    ...eventOverrides,
  });
}

function renderStep(
  event: BirthGivingEventDetail,
  onEventChange: (event: BirthGivingEventDetail | null) => void,
) {
  return render(
    <BirthGivingRetrospectiveTeamsStep
      event={event}
      profileId="org-1"
      organizerProfiles={makeAllProfiles()}
      now={NOW}
      onEventChange={onEventChange}
    />,
  );
}

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingRetrospectiveTeamsStep", () => {
  it("autosaves team name edits against the canonical draft", async () => {
    const user = userEvent.setup();
    const event = eventWithTeam();
    const onEventChange = vi.fn();
    stubFetch((url, init) => {
      if (url.endsWith("/teams/team-1") && init.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { name: string };
        return json({
          data: { ...event, teams: [{ ...event.teams[0], name: body.name }] },
        });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    const nameInput = screen.getByLabelText("Název týmu") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Nový název");
    await user.tab();

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/teams/team-1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            name: "Nový název",
            memberProfileIds: ["member-1"],
            isWinner: false,
          }),
        }),
      ),
    );
  });
});