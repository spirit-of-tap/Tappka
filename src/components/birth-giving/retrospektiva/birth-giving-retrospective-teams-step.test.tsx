import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingRetrospectiveTeamsStep } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-teams-step";
import {
  makeAllProfiles,
  makeDraftEvent,
  makeMemberWithProfile,
  makeResultFile,
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
        status: "confirmed",
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
      if (url.endsWith("/historical-teams/team-1") && init.method === "PATCH") {
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
    await user.type(nameInput, "Tým Beta");
    await user.tab();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/historical-teams/team-1");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Tým Beta",
      memberProfileIds: ["member-1"],
      resultState: "present",
    });
    await waitFor(() =>
      expect(onEventChange).toHaveBeenCalledWith(
        expect.objectContaining({
          teams: [expect.objectContaining({ name: "Tým Beta" })],
        }),
      ),
    );
  });

  it("persists membership changes through the existing-profile selector immediately", async () => {
    const user = userEvent.setup();
    const event = eventWithTeam();
    const onEventChange = vi.fn();
    stubFetch((url, init) => {
      if (url.endsWith("/historical-teams/team-1") && init.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { memberProfileIds: string[] };
        return json({
          data: {
            ...event,
            teams: [
              {
                ...event.teams[0],
                members: body.memberProfileIds.map((profileId) =>
                  makeMemberWithProfile({ profile_id: profileId }),
                ),
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    await user.click(screen.getByRole("button", { name: "Člen:ky týmu" }));
    await user.click(await screen.findByText("Candidate One"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      memberProfileIds: ["member-1", "candidate-1"],
    });
  });

  it("creates a new historical team with explicit result state and selected profiles", async () => {
    const user = userEvent.setup();
    const event = makeDraftEvent({ teams: [] });
    const onEventChange = vi.fn();
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/event-1/historical-teams" && init.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string };
        return json(
          {
            data: {
              ...event,
              teams: [
                makeTeam({
                  id: "team-new",
                  status: "confirmed",
                  name: body.name,
                  members: [makeMemberWithProfile({ profile_id: "candidate-2" })],
                }),
              ],
            },
          },
          201,
        );
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    expect(screen.getByText("Zatím nejsou vytvořené žádné týmy.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Přidat tým" }));
    await user.type(screen.getByLabelText("Název týmu"), "Tým Nový");
    await user.click(screen.getByRole("button", { name: "Člen:ky týmu" }));
    await user.click(await screen.findByText("Candidate Two"));
    await user.click(screen.getByRole("button", { name: "Vytvořit tým" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/birth-giving/events/event-1/historical-teams");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Tým Nový",
      memberProfileIds: ["candidate-2"],
      resultState: "present",
    });
    await waitFor(() =>
      expect(onEventChange).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1" })),
    );
  });

  it("marks a team result as missing through the canonical route", async () => {
    const user = userEvent.setup();
    const event = eventWithTeam();
    const onEventChange = vi.fn();
    stubFetch((url, init) => {
      if (url.endsWith("/teams/team-1/results/missing")) {
        return json({ data: { state: "missing" } });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    await user.click(screen.getByRole("button", { name: "Označit výsledek jako nedohledaný" }));
    await user.click(screen.getByRole("button", { name: "Potvrdit" }));

    await waitFor(() =>
      expect(
        fetchSpy,
      ).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/teams/team-1/results/missing",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(null));
  });

  it("lets an organizer revisit a missing result and switch it back to present", async () => {
    const user = userEvent.setup();
    const event = eventWithTeam({ result_state: "missing" });
    const onEventChange = vi.fn();
    stubFetch((url, init) => {
      if (url.endsWith("/historical-teams/team-1") && init.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { resultState: string };
        return json({
          data: { ...event, teams: [{ ...event.teams[0], result_state: body.resultState }] },
        });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    expect(screen.getByText("Výsledek nedohledán")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Označit výsledek jako přítomný" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ resultState: "present" });
  });

  it("ignores a second rapid submit of the create form so a team is not double-created", async () => {
    const user = userEvent.setup();
    const event = makeDraftEvent({ teams: [] });
    const onEventChange = vi.fn();
    const created: string[] = [];
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/event-1/historical-teams" && init.method === "POST") {
        created.push(url);
        return json(
          {
            data: {
              ...event,
              teams: [makeTeam({ id: "team-new", name: "Tým Nový", members: [makeMemberWithProfile({ profile_id: "candidate-2" })] })],
            },
          },
          201,
        );
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);
    await user.click(screen.getByRole("button", { name: "Přidat tým" }));
    await user.type(screen.getByLabelText("Název týmu"), "Tým Nový");
    await user.click(screen.getByRole("button", { name: "Člen:ky týmu" }));
    await user.click(await screen.findByText("Candidate Two"));

    const form = screen.getByRole("button", { name: "Vytvořit tým" }).closest("form");
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(created).toHaveLength(1));
  });

  it("disables result-file mutations while the team editor save is in flight", async () => {
    const user = userEvent.setup();
    const event = eventWithTeam({ result_files: [makeResultFile()] });
    const onEventChange = vi.fn();
    const deferred: { resolve: ((value: Response) => void) | null } = { resolve: null };
    stubFetch((url, init) => {
      if (url.endsWith("/historical-teams/team-1") && init.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          deferred.resolve = resolve;
        });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderStep(event, onEventChange);

    const deleteButton = screen.getByRole("button", { name: "Smazat soubor vysledky.pdf" });
    const uploadButton = screen.getByRole("button", { name: "Nahrát soubory" });
    expect(deleteButton).toBeEnabled();
    expect(uploadButton).toBeEnabled();

    const nameInput = screen.getByLabelText("Název týmu");
    await user.clear(nameInput);
    await user.type(nameInput, "Tým Beta");
    await user.tab();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(deleteButton).toBeDisabled();
    expect(uploadButton).toBeDisabled();

    deferred.resolve?.(json({ data: event }));
    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(uploadButton).toBeEnabled();
  });
});