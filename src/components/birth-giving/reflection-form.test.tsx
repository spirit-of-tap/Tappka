import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingReflectionForm } from "@/components/birth-giving/reflection-form";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingReflectionForm", () => {
  it("submits contribution and learning", async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    } as Response);

    render(
      <BirthGivingReflectionForm
        eventId="event-1"
        onEventChange={onEventChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Napsat reflexi" }));
    await user.type(
      screen.getByLabelText("V čem spočíval váš přínos týmu?"),
      "Organizoval:a jsem tým.",
    );
    await user.type(
      screen.getByLabelText("Co jste se naučili:y nebo co byste příště udělali:y jinak?"),
      "Vyzkoušel:a jsem nové metody.",
    );
    await user.click(screen.getByRole("button", { name: "Uložit reflexi" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/event-1/reflection",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            contribution: "Organizoval:a jsem tým.",
            learning: "Vyzkoušel:a jsem nové metody.",
          }),
        }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalled());
  });
});