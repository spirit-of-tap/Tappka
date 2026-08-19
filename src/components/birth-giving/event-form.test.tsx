import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingEventForm } from "@/components/birth-giving/event-form";
import { makeEvent, makeOrganizerSummaries } from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingEventForm", () => {
  it("creates an event through the canonical API", async () => {
    const user = userEvent.setup();
    const created = makeEvent();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: created }),
    } as Response);
    const onSuccess = vi.fn();

    render(
      <BirthGivingEventForm
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Název události"), "First BG");
    await user.type(screen.getByLabelText("Zákazník"), "Zákazník A");
    await user.type(screen.getByLabelText("Začátek"), "2026-08-19T08:00");
    const minInput = screen.getByLabelText("Min. velikost týmu") as HTMLInputElement;
    const maxInput = screen.getByLabelText("Max. velikost týmu") as HTMLInputElement;
    await user.clear(minInput);
    await user.type(minInput, "2");
    await user.clear(maxInput);
    await user.type(maxInput, "4");
    await user.click(screen.getByRole("button", { name: "Organizátor:ky" }));
    await user.click(await screen.findByText("Org Two"));
    await user.click(screen.getByRole("button", { name: "Vytvořit událost" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events",
        expect.objectContaining({ method: "POST" }),
      );
      const { body } = fetchSpy.mock.calls[0][1] as { body: string };
      const payload = JSON.parse(body) as Record<string, unknown>;
      expect(payload).toEqual(
        expect.objectContaining({
          name: "First BG",
          customer: "Zákazník A",
          startsAt: expect.any(String),
          duration: "8h",
          minimumTeamSize: 2,
          maximumTeamSize: 4,
          joiningOpen: true,
          organizerProfileIds: ["org-1", "org-2"],
        }),
      );
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(created));
  });

  it("refuses to submit with an empty name", async () => {
    const user = userEvent.setup();
    render(
      <BirthGivingEventForm
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Vytvořit událost" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Název události je povinný");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("updates an existing event through PATCH with prefilled values", async () => {
    const user = userEvent.setup();
    const event = makeEvent({ name: "Stará událost" });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { ...event, name: "Nová událost" } }),
    } as Response);
    const onSuccess = vi.fn();

    render(
      <BirthGivingEventForm
        event={event}
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText("Název události");
    expect((nameInput as HTMLInputElement).value).toBe("Stará událost");
    await user.clear(nameInput);
    await user.type(nameInput, "Nová událost");
    await user.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows duplicate candidates and a link when the event already exists", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "DUPLICATE_EVENT",
        error: "Stejná Birth Giving událost už existuje.",
        data: {
          id: "existing-1",
          status: "published",
          identity: { eventName: "First BG", customer: "Zákazník A", startsAt: "2026-08-19T08:00:00.000Z" },
        },
      }),
    } as Response);

    render(
      <BirthGivingEventForm
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Název události"), "First BG");
    await user.type(screen.getByLabelText("Zákazník"), "Zákazník A");
    await user.type(screen.getByLabelText("Začátek"), "2026-08-19T08:00");
    const minInput = screen.getByLabelText("Min. velikost týmu") as HTMLInputElement;
    const maxInput = screen.getByLabelText("Max. velikost týmu") as HTMLInputElement;
    await user.clear(minInput);
    await user.type(minInput, "2");
    await user.clear(maxInput);
    await user.type(maxInput, "4");
    await user.click(screen.getByRole("button", { name: "Vytvořit událost" }));

    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First BG/ })).toHaveAttribute(
      "href",
      "/birth-giving/existing-1",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});