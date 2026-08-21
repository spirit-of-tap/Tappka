import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingAssignmentPanel } from "@/components/birth-giving/assignment-panel";
import {
  makeAssignment,
  makeEvent,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

const FUTURE_START = "2026-08-19T15:00:00.000Z";

describe("BirthGivingAssignmentPanel", () => {
  it("keeps a non-organizer locked out before the event with a countdown", () => {
    const event = makeEvent(
      { starts_at: FUTURE_START },
      { assignment: makeAssignment() },
    );
    render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání bude zveřejněno za 3 h")).toBeInTheDocument();
    expect(screen.queryByText("zadani.pdf")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Stáhnout zadání" })).not.toBeInTheDocument();
  });

  it("lets an organizer see and download the file before the start", () => {
    const event = makeEvent(
      { starts_at: FUTURE_START },
      { assignment: makeAssignment() },
    );
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
    const event = makeEvent({}, { assignment: makeAssignment() });
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
    const event = makeEvent({ starts_at: FUTURE_START }, { assignment: null });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="org-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Soubor se zadáním")).toBeInTheDocument();
  });

  it("lets an organizer mark a missing assignment as not recovered after the end", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { state: "missing" } }),
    } as Response);
    const onEventChange = vi.fn();
    const event = makeEvent({}, { assignment: null });
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
    const event = makeEvent({}, { assignment: makeAssignment({ state: "missing" }) });
    render(
      <BirthGivingAssignmentPanel event={event} profileId="org-1" now="2026-08-19T18:00:00.000Z" onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání nedohledáno")).toBeInTheDocument();
  });

  it("resyncs the countdown when the now prop changes", () => {
    const event = makeEvent({ starts_at: FUTURE_START }, { assignment: makeAssignment() });
    const { rerender } = render(
      <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Zadání bude zveřejněno za 3 h")).toBeInTheDocument();

    rerender(
      <BirthGivingAssignmentPanel
        event={event}
        profileId="member-1"
        now="2026-08-19T14:00:00.000Z"
        onEventChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Zadání bude zveřejněno za 1 h")).toBeInTheDocument();
  });

  it("pauses the countdown while the document is hidden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    try {
      const event = makeEvent({ starts_at: FUTURE_START }, { assignment: makeAssignment() });
      render(
        <BirthGivingAssignmentPanel event={event} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
      );

      expect(screen.getByText("Zadání bude zveřejněno za 3 h")).toBeInTheDocument();

      act(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(screen.getByText("Zadání bude zveřejněno za 3 h")).toBeInTheDocument();

      act(() => {
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        vi.setSystemTime(new Date("2026-08-19T12:02:00.000Z"));
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(screen.getByText("Zadání bude zveřejněno za 2 h 58 min")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    }
  });
});