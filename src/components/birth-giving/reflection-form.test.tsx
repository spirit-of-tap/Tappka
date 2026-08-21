import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingReflectionForm } from "@/components/birth-giving/reflection-form";

describe("BirthGivingReflectionForm", () => {
  it("submits contribution and learning", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BirthGivingReflectionForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Přínos"), "Organizoval jsem tým.");
    await user.type(screen.getByLabelText("Poučení"), "Vyzkoušel jsem nové metody.");
    await user.click(screen.getByRole("button", { name: "Uložit reflexi" }));

    expect(onSubmit).toHaveBeenCalledWith({
      contribution: "Organizoval jsem tým.",
      learning: "Vyzkoušel jsem nové metody.",
    });
  });

  it("requires both fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BirthGivingReflectionForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Přínos"), "Jen přínos");
    await user.click(screen.getByRole("button", { name: "Uložit reflexi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Poučení je povinné",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});