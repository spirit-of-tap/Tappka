import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileBottomNav } from "./mobile-bottom-nav";

const pathname: { current: string } = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("MobileBottomNav", () => {
  it("renders all three tabs with correct hrefs", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("href", "/moduly");
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profil");
  });

  it("marks the active tab on the home page", () => {
    pathname.current = "/";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Moduly" })).not.toHaveAttribute("aria-current");
  });

  it("marks the Moduly tab as active on the hub and inside a module", () => {
    pathname.current = "/moduly";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("aria-current", "page");

    pathname.current = "/moduly/nastroje-techniky";
    cleanup();
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Profil tab as active on the hub", () => {
    pathname.current = "/profil";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves all tabs inactive on a module page", () => {
    pathname.current = "/reservations";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Moduly" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current");
  });
});