import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingTeamForm } from "@/components/birth-giving/team-form";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingTeamForm", () => {
  it("creates a team through the canonical API", async () => {
    const user = userEvent.setup();
    const refreshed = { id: "event-1" };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: refreshed }),
    } as Response);
    const onSuccess = vi.fn();

    render(<BirthGivingTeamForm eventId="event-1" onSuccess={onSuccess} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText("Název týmu"), "Tým Alfa");
    await user.click(screen.getByRole("button", { name: "Vytvořit tým" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/teams",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Tým Alfa" }),
        }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(refreshed));
  });

  it("requires a team name", async () => {
    const user = userEvent.setup();
    render(<BirthGivingTeamForm eventId="event-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Vytvořit tým" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Název týmu je povinný");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});