import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ModuleGrid } from "./module-grid";
import { NAV_MODULES } from "@/lib/navigation";

describe("ModuleGrid", () => {
  it("renders a card per module with title, description and link", () => {
    render(<ModuleGrid modules={NAV_MODULES} />);
    expect(screen.getByRole("heading", { name: "Místnosti" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Místnosti/ })).toHaveAttribute("href", "/reservations");
    expect(screen.getByText(/Rezervace místností/)).toBeInTheDocument();
  });

  it("shows a Beta badge on beta-only modules", () => {
    render(<ModuleGrid modules={NAV_MODULES} profileId="user-1" />);
    expect(screen.getAllByText("Beta").length).toBe(NAV_MODULES.filter((m) => m.betaOnly).length);
    const mistnosti = screen.getByRole("link", { name: /Místnosti/ });
    expect(within(mistnosti).queryByText("Beta")).not.toBeInTheDocument();
  });

  it("hides own-profile modules when no profileId is given", () => {
    render(<ModuleGrid modules={NAV_MODULES} />);
    expect(screen.queryByRole("link", { name: /Osobnostní testy/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Místnosti/ })).toBeInTheDocument();
  });

  it("links the personality tests card to the own profile tab when profileId is given", () => {
    render(<ModuleGrid modules={NAV_MODULES} profileId="user-1" />);
    const link = screen.getByRole("link", { name: /Osobnostní testy/ });
    expect(link).toHaveAttribute("href", "/komunita/profil/user-1?tab=osobnostni-testy");
  });

  it("renders high-traffic modules as full-width featured cards", () => {
    render(<ModuleGrid modules={NAV_MODULES} profileId="user-1" />);
    const cteni = screen.getByRole("link", { name: /Čtení/ });
    expect(cteni.className).toContain("col-span-2");
    const koucovani = screen.getByRole("link", { name: /Koučování/ });
    expect(koucovani.className).not.toContain("col-span-2");
  });
});
