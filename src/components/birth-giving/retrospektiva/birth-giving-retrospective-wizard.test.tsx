import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingRetrospectiveWizard } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-wizard";
import {
  makeDraftEvent,
  makeOrganizerSummaries,
  makeAssignment,
  makeMemberWithProfile,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.spyOn(globalThis, "fetch");

type FetchStub = (url: string, init: Init) => Response;

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

function stubFetch(stub: FetchStub) {
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

const PROFILES: BirthGivingProfileSummary[] = makeOrganizerSummaries();

async function fillEventStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Název události"), "Letní BG");
  await user.type(screen.getByLabelText("Zákazník"), "Zákazník A");
  await user.type(screen.getByLabelText("Začátek"), "2024-08-19T08:00");
}

function renderWizard() {
  return render(
    <BirthGivingRetrospectiveWizard profileId="org-1" organizerProfiles={PROFILES} />,
  );
}

async function createDraftAndReachZadani(user: ReturnType<typeof userEvent.setup>) {
  await fillEventStep(user);
  await user.click(screen.getByRole("button", { name: "Vytvořit koncept" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Pokračovat na Zadání" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Pokračovat na Zadání" }));
  expect(screen.getByRole("heading", { name: "Zadání" })).toBeInTheDocument();
}

async function reachKontrola(user: ReturnType<typeof userEvent.setup>) {
  await createDraftAndReachZadani(user);
  await user.click(screen.getByRole("button", { name: "Pokračovat na Týmy a výsledky" }));
  await user.click(screen.getByRole("button", { name: "Pokračovat na kontrolu" }));
  expect(screen.getByRole("heading", { name: "Kontrola" })).toBeInTheDocument();
}

beforeEach(() => {
  push.mockReset();
  fetchSpy.mockReset();
});

describe("BirthGivingRetrospectiveWizard", () => {
  it("creates the draft and moves through the four steps with back navigation", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent();
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();

    expect(screen.getByRole("heading", { name: "Událost" })).toBeInTheDocument();

    await fillEventStep(user);
    await user.click(screen.getByRole("button", { name: "Vytvořit koncept" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Pokračovat na Zadání" }));

    expect(screen.queryByRole("heading", { name: "Týmy a výsledky" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pokračovat na Týmy a výsledky" }));
    expect(screen.getByRole("heading", { name: "Týmy a výsledky" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokračovat na kontrolu" }));
    expect(screen.getByRole("heading", { name: "Kontrola" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zpět" }));
    expect(screen.getByRole("heading", { name: "Týmy a výsledky" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zpět" }));
    expect(screen.getByRole("heading", { name: "Zadání" })).toBeInTheDocument();
  });

  it("blocks draft creation until near duplicates are explicitly confirmed", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    const draft = makeDraftEvent();
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") {
        return json({
          data: [
            {
              id: "existing-1",
              status: "published",
              name: "Letní BG",
              customer: "Zákazník A",
              starts_at: "2024-08-19T08:00:00.000Z",
            },
          ],
        });
      }
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        created.push(url);
        return json({ data: draft }, 201);
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await fillEventStep(user);
    await user.click(screen.getByRole("button", { name: "Vytvořit koncept" }));

    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Letní BG/ }),
    ).toHaveAttribute("href", "/birth-giving/existing-1");
    expect(created).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Je to jiná událost. Pokračovat" }));
    await waitFor(() => expect(created).toHaveLength(1));
  });

  it("offers to resume an existing draft when the identity already has one", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent({ id: "draft-1" });
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json(
          {
            code: "DUPLICATE_EVENT",
            error: "Stejná Birth Giving událost už existuje.",
            data: {
              id: "draft-1",
              status: "draft",
              identity: {
                eventName: "Letní BG",
                customer: "Zákazník A",
                startsAt: "2024-08-19T08:00:00.000Z",
              },
            },
          },
          409,
        );
      }
      if (url === "/api/birth-giving/events/draft-1" && init.method === "GET") {
        return json({ data: draft });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await fillEventStep(user);
    await user.click(screen.getByRole("button", { name: "Vytvořit koncept" }));

    expect(await screen.findByText("Rozepsaný koncept existuje")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pokračovat v rozepsaném konceptu" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pokračovat na Zadání" })).toBeEnabled(),
    );
    expect((screen.getByLabelText("Název události") as HTMLInputElement).value).toBe("First BG");
    expect(
      fetchSpy,
    ).toHaveBeenCalledWith("/api/birth-giving/events/draft-1", expect.objectContaining({ method: "GET" }));
  });

  it("marks the assignment as missing and refreshes the canonical state", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent({ assignment: null });
    const withMissingAssignment = makeDraftEvent({
      assignment: makeAssignment({ state: "missing" }),
    });
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      if (url === "/api/birth-giving/events/event-1/assignment/missing") {
        return json({ data: { state: "missing" } });
      }
      if (url === "/api/birth-giving/events/event-1" && init.method === "GET") {
        return json({ data: withMissingAssignment });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await createDraftAndReachZadani(user);

    await user.click(screen.getByRole("button", { name: "Označit zadání jako nedohledané" }));
    await user.click(screen.getByRole("button", { name: "Potvrdit" }));

    await waitFor(() =>
      expect(
        screen.getByText("Zadání nedohledáno"),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1",
        expect.objectContaining({ method: "GET" }),
      ),
    );
  });

  it("shows publication validation errors and refreshes state from the canonical response", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent({ teams: [] });
    const draftWithTeam = makeDraftEvent({
      teams: [
        makeTeam({
          id: "team-1",
          status: "confirmed",
          result_state: "missing",
          members: [makeMemberWithProfile()],
        }),
      ],
    });
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      if (url === "/api/birth-giving/events/event-1/publish") {
        return json(
          {
            code: "PUBLICATION_INVALID",
            error: "Událost nesplňuje podmínky pro zveřejnění.",
            data: draftWithTeam,
          },
          422,
        );
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await reachKontrola(user);

    expect(await screen.findByText("Zatím chybí alespoň jeden tým.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zveřejnit událost" }));

    await waitFor(() =>
      expect(
        screen.getByText("Událost nesplňuje podmínky pro zveřejnění."),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText("Zatím chybí alespoň jeden tým.")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Tým Alfa/).length).toBeGreaterThan(0);
  });

  it("keeps the draft editable after an EVENT_LOCKED publish response", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent();
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      if (url === "/api/birth-giving/events/event-1/publish") {
        return json(
          {
            code: "EVENT_LOCKED",
            error: "Událost už v této fázi nelze změnit.",
            data: draft,
          },
          409,
        );
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await reachKontrola(user);
    await user.click(screen.getByRole("button", { name: "Zveřejnit událost" }));

    await waitFor(() =>
      expect(
        screen.getByText("Událost už v této fázi nelze změnit."),
      ).toBeInTheDocument(),
    );
  });

  it("navigates to the published event after a successful publish", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent({
      teams: [
        makeTeam({
          id: "team-1",
          status: "confirmed",
          result_state: "missing",
          members: [makeMemberWithProfile()],
        }),
      ],
    });
    const published: BirthGivingEventDetail = { ...draft, status: "published" };
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events/duplicate-candidates") return json({ data: [] });
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      if (url === "/api/birth-giving/events/event-1/publish") {
        return json({ data: published });
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await reachKontrola(user);
    await user.click(screen.getByRole("button", { name: "Zveřejnit událost" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/birth-giving/event-1"));
  });
});