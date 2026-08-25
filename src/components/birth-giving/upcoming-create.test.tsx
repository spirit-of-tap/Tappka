import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingUpcomingCreate } from "@/components/birth-giving/upcoming-create";
import {
  makeEvent,
  makeOrganizerSummaries,
} from "@/tests/component/birth-giving-fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.spyOn(globalThis, "fetch");

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  push.mockReset();
  fetchSpy.mockReset();
});

describe("BirthGivingUpcomingCreate", () => {
  it("uses the shared event form and routes to the new event on success", async () => {
    const user = userEvent.setup();
    const created = makeEvent();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: created }, 201));

    render(
      <BirthGivingUpcomingCreate
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
      />,
    );

    expect(screen.getByRole("button", { name: "Vytvořit událost" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Název události"), "Letní BG");
    await user.type(screen.getByLabelText("Zákazník"), "Zákazník A");
    await user.type(screen.getByLabelText("Začátek"), "2026-09-01T08:00");
    await user.click(screen.getByRole("button", { name: "Vytvořit událost" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/birth-giving/event-1"));
  });
});