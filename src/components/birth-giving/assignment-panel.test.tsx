import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingAssignmentPanel } from "@/components/birth-giving/assignment-panel";
import {
  makeEvent,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

const FUTURE_START = "2026-08-19T15:00:00.000Z";

describe("BirthGivingAssignmentPanel", () => {
  it("keeps an attendee locked out before the event with a neutral message", () => {
    const event = makeEvent({
      starts_at: FUTURE_START,
      assignment_state: "present",
      assignment_file_name: "zadani.pdf",
    });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání se zveřejní na začátku akce.")).toBeInTheDocument();
    expect(screen.queryByText("zadani.pdf")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Stáhnout zadání" })).not.toBeInTheDocument();
    expect(screen.queryByText("Zadání zatím nebylo nahráno.")).not.toBeInTheDocument();
  });

  it("shows the not-uploaded message to attendees only after the start", () => {
    const event = makeEvent({
      starts_at: FUTURE_START,
      assignment_state: "none",
    });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání se zveřejní na začátku akce.")).toBeInTheDocument();
    expect(screen.queryByText("Zadání zatím nebylo nahráno.")).not.toBeInTheDocument();
  });

  it("lets an organizer see and download the file before the start", () => {
    const event = makeEvent({
      starts_at: FUTURE_START,
      assignment_state: "present",
      assignment_file_name: "zadani.pdf",
    });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="org-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("zadani.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stáhnout zadání" })).toHaveAttribute(
      "href",
      "/api/birth-giving/events/event-1/assignment/download",
    );
    expect(screen.getByText("Vybrat soubor se zadáním")).toBeInTheDocument();
  });

  it("releases the assignment to the community after the start", () => {
    const event = makeEvent({
      assignment_state: "present",
      assignment_file_name: "zadani.pdf",
    });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("zadani.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stáhnout zadání" })).toHaveAttribute(
      "href",
      "/api/birth-giving/events/event-1/assignment/download",
    );
    expect(screen.queryByText("Vybrat soubor se zadáním")).not.toBeInTheDocument();
  });

  it("gives an organizer the upload panel while an assignment is missing", () => {
    const event = makeEvent({ starts_at: FUTURE_START, assignment_state: "none" });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="org-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Soubor se zadáním")).toBeInTheDocument();
  });

  it("lets an organizer mark a missing assignment", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { assignment_state: "missing" } }),
    } as Response);
    const onEventChange = vi.fn();
    const event = makeEvent({ assignment_state: "none" });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="org-1" now="2026-08-19T18:00:00.000Z" onEventChange={onEventChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Označit zadání jako nedohledané" }));
    await user.click(await screen.findByRole("button", { name: "Potvrdit" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/assignment/missing",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });

  it("shows the missing badge for an unrecovered assignment", () => {
    const event = makeEvent({ assignment_state: "missing" });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání nedohledáno")).toBeInTheDocument();
  });
});