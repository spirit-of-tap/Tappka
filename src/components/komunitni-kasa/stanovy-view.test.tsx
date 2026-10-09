import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StanovyView } from "./stanovy-view";

describe("StanovyView", () => {
  it("renders top overview card with association name and IČO", () => {
    render(<StanovyView />);

    expect(screen.getByText("Spirit of TAP, z.s.")).toBeInTheDocument();
    expect(screen.getByText(/231 52 036/)).toBeInTheDocument();
    expect(screen.getByText(/L 80354/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /veřejný rejstřík/i })).toHaveAttribute(
      "href",
      expect.stringContaining("or.justice.cz"),
    );
  });

  it("renders the 3 main tabs and defaults to Platné stanovy", () => {
    render(<StanovyView />);

    expect(screen.getByRole("tab", { name: /platné stanovy/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /výpis z rejstříku/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sbírka listin/i })).toBeInTheDocument();

    expect(screen.getByText(/Čl\. 1 · Základní ustanovení/i)).toBeInTheDocument();
  });

  it("filters articles based on search query", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);

    const searchInput = screen.getByRole("textbox", { name: /hledat v textu stanov/i });
    await user.type(searchInput, "likvidační zůstatek");

    expect(screen.getByText(/Čl\. 4 · Zisk a likvidační zůstatek/i)).toBeInTheDocument();
    expect(screen.queryByText(/Čl\. 1 · Základní ustanovení/i)).not.toBeInTheDocument();
  });

  it("displays výpis z rejstříku when tab is clicked", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);

    await user.click(screen.getByRole("tab", { name: /výpis z rejstříku/i }));

    expect(screen.getByText(/Statutární orgán — předseda/i)).toBeInTheDocument();
    expect(screen.getByText(/Tuuli Co\. Družstvo/i)).toBeInTheDocument();
    expect(screen.getByText(/Julie Holá/i)).toBeInTheDocument();
    expect(screen.getByText(/Předmět hlavní činnosti/i)).toBeInTheDocument();
  });

  it("displays sbírka listin and zápis z členské schůze when tab is clicked", async () => {
    const user = userEvent.setup();
    render(<StanovyView />);

    await user.click(screen.getByRole("tab", { name: /sbírka listin/i }));

    expect(screen.getByText(/L 80354\/SL3\/MSPH/i)).toBeInTheDocument();
    expect(screen.getByText(/L 80354\/SL2\/MSPH/i)).toBeInTheDocument();
    expect(screen.getByText(/L 80354\/SL1\/MSPH/i)).toBeInTheDocument();
    expect(screen.getByText(/Zápis z členské schůze ze dne 3\. 6\. 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Změna sídla spolku/i)).toBeInTheDocument();
  });
});
