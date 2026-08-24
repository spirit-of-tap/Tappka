import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingRetrospectiveWizard } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-wizard";
import {
  makeDraftEvent,
  makeOrganizerSummaries,
} from "@/tests/component/birth-giving-fixtures";
import type { BirthGivingProfileSummary } from "@/lib/birth-giving/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

function stubFetch(stub: (url: string, init: Init) => Response) {
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

beforeEach(() => {
  push.mockReset();
  fetchSpy.mockReset();
});

describe("BirthGivingRetrospectiveWizard", () => {
  it("creates the draft and moves to the zadani step", async () => {
    const user = userEvent.setup();
    const draft = makeDraftEvent();
    stubFetch((url, init) => {
      if (url === "/api/birth-giving/events" && init.method === "POST") {
        return json({ data: draft }, 201);
      }
      throw new Error(`Unexpected fetch: ${init.method} ${url}`);
    });

    renderWizard();
    await fillEventStep(user);
    await user.click(screen.getByRole("button", { name: "Uložit a pokračovat" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"name":"Letní BG"'),
        }),
      );
    });

    expect(await screen.findByText("Pokračovat na Týmy a výsledky")).toBeInTheDocument();
  });
});