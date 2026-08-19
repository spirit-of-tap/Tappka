import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingEventMetadata } from "@/components/birth-giving/event-metadata";
import { makeEvent, makeOrganizerSummaries, NOW } from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingEventMetadata", () => {
  it("shows the shared event fields", () => {
    const event = makeEvent();
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("First BG")).toBeInTheDocument();
    expect(screen.getByText("Zákazník A")).toBeInTheDocument();
    expect(screen.getByText(/19\. 8\. 2026/)).toBeInTheDocument();
    expect(screen.getByText("8 h")).toBeInTheDocument();
    expect(screen.getByText("2–4")).toBeInTheDocument();
    expect(screen.getByText("Org One")).toBeInTheDocument();
  });

  it("labels the organizer field in gender-neutral Czech", () => {
    const event = makeEvent();
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Organizátor:ky")).toBeInTheDocument();
    expect(screen.queryByText("Organizátoři")).not.toBeInTheDocument();
  });

  it("publishes an organizer's draft through the canonical endpoint", async () => {
    const user = userEvent.setup();
    const published = makeEvent({ id: "draft-1", status: "published" });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: published }),
    } as Response);
    const onEventChange = vi.fn();
    render(
      <BirthGivingEventMetadata
        event={makeEvent({ id: "draft-1", status: "draft" })}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={onEventChange}
      />,
    );

    expect(screen.getByText("Koncept")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zveřejnit" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/draft-1/publish",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(published));
  });

  it("hides the publish action for everyone except the organizers of a draft", () => {
    render(
      <BirthGivingEventMetadata
        event={makeEvent({ id: "draft-1", status: "draft" })}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Zveřejnit" })).not.toBeInTheDocument();
  });

  it("hides the publish action once the event is published", () => {
    render(
      <BirthGivingEventMetadata
        event={makeEvent({ status: "published" })}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Zveřejnit" })).not.toBeInTheDocument();
  });

  it("surfaces publication-validation failures and keeps the latest state", async () => {
    const user = userEvent.setup();
    const toastModule = await import("sonner");
    const errorSpy = vi
      .spyOn(toastModule.toast, "error")
      .mockImplementation(() => "");
    const refreshed = makeEvent({ id: "draft-1", status: "draft" });
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: "PUBLICATION_INVALID",
        error: "Událost nesplňuje podmínky pro zveřejnění.",
        data: refreshed,
      }),
    } as Response);
    const onEventChange = vi.fn();
    render(
      <BirthGivingEventMetadata
        event={makeEvent({ id: "draft-1", status: "draft" })}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={onEventChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Zveřejnit" }));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Událost nesplňuje podmínky pro zveřejnění."),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(refreshed));
  });

  it("hides the edit action for a non-organizer", () => {
    const event = makeEvent();
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="member-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Upravit událost" })).not.toBeInTheDocument();
  });

  it("opens a prefilled edit dialog for an organizer before the end", async () => {
    const user = userEvent.setup();
    const event = makeEvent({ name: "Stará událost" });
    render(
      <BirthGivingEventMetadata
        event={event}
        profileId="org-1"
        now={NOW}
        organizerProfiles={makeOrganizerSummaries()}
        onEventChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Upravit událost" }));

    const nameInput = await screen.findByLabelText("Název události");
    expect(nameInput).toHaveValue("Stará událost");
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeInTheDocument();
  });
});