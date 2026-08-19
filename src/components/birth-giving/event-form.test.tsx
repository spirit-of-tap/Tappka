import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingEventForm } from "@/components/birth-giving/event-form";
import { makeEvent, makeOrganizerSummaries } from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
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
}

function duplicateCheckResponse(candidates: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: candidates }),
  } as Response;
}

describe("BirthGivingEventForm", () => {
  it("checks near duplicates and creates an event through the canonical API", async () => {
    const user = userEvent.setup();
    const created = makeEvent();
    fetchSpy
      .mockResolvedValueOnce(duplicateCheckResponse())
      .mockResolvedValueOnce({
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

    await fillCreateForm(user);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        "/api/birth-giving/events/duplicate-candidates",
        expect.objectContaining({ method: "POST" }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        "/api/birth-giving/events",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const gateBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as { body: string }).body,
    ) as Record<string, unknown>;
    expect(Object.keys(gateBody).sort()).toEqual(["customer", "name", "startsAt"]);
    const { body } = fetchSpy.mock.calls[1][1] as { body: string };
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

  it("updates an existing event through PATCH with prefilled values without the duplicate gate", async () => {
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

  it("blocks creation and shows candidates when near duplicates are found", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce(
      duplicateCheckResponse([
        {
          id: "existing-1",
          status: "published",
          name: "First BG",
          customer: "Zákazník A",
          starts_at: "2026-08-19T08:00:00.000Z",
        },
      ]),
    );

    render(
      <BirthGivingEventForm
        profileId="org-1"
        organizerProfiles={makeOrganizerSummaries()}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await fillCreateForm(user);

    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First BG/ })).toHaveAttribute(
      "href",
      "/birth-giving/existing-1",
    );
    expect(screen.getByText("19. 8. 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Je to jiná událost. Pokračovat" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledTimes(1),
    );
  });

  it("creates the event only after explicit duplicate confirmation", async () => {
    const user = userEvent.setup();
    const created = makeEvent();
    fetchSpy
      .mockResolvedValueOnce(
        duplicateCheckResponse([
          {
            id: "existing-1",
            status: "published",
            name: "First BG",
            customer: "Zákazník A",
            starts_at: "2026-08-19T08:00:00.000Z",
          },
        ]),
      )
      .mockResolvedValueOnce({
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

    await fillCreateForm(user);
    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: "Je to jiná událost. Pokračovat" }),
    );

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        "/api/birth-giving/events",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(created));
  });

  it("maps an exact duplicate race to the canonical link", async () => {
    const user = userEvent.setup();
    fetchSpy
      .mockResolvedValueOnce(duplicateCheckResponse())
      .mockResolvedValueOnce({
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

    await fillCreateForm(user);

    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First BG/ })).toHaveAttribute(
      "href",
      "/birth-giving/existing-1",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});