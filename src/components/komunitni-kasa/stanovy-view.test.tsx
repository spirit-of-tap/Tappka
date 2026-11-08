import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StanovyView } from "./stanovy-view";

describe("StanovyView", () => {
  it("lists the articles without the old tabs", () => {
    render(<StanovyView />);
    expect(screen.getByText(/Čl\. 1 · Základní ustanovení/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("filters articles based on search query", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);

    await user.type(screen.getByRole("searchbox", { name: /hledat v textu stanov/i }), "likvidační zůstatek");

    expect(screen.getByText(/Čl\. 4 · Zisk a likvidační zůstatek/i)).toBeInTheDocument();
    expect(screen.queryByText(/Čl\. 1 · Základní ustanovení/i)).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);
    await user.type(screen.getByRole("searchbox", { name: /hledat v textu stanov/i }), "xyzxyz");
    expect(screen.getByText(/žádný článek/i)).toBeInTheDocument();
  });

  it("expands an article to show its text", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);
    const trigger = screen.getByRole("button", { name: /Čl\. 4 · Zisk a likvidační zůstatek/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
