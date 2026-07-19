import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewFeedbackForm } from "@/components/feedback/new-feedback-form";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("NewFeedbackForm", () => {
  it("disables submit when empty", () => {
    render(<NewFeedbackForm onCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Odeslat/i })).toBeDisabled();
  });

  it("posts body and calls onCreated, then clears", async () => {
    const created = { id: "f1", body: "Ahoj", author: { id: "p1", name: "Já", picture: null, role: "student" } };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: created }),
    } as Response);
    const onCreated = vi.fn();

    render(<NewFeedbackForm onCreated={onCreated} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Ahoj");
    await userEvent.click(screen.getByRole("button", { name: /Odeslat/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST" }),
    );
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });
});
