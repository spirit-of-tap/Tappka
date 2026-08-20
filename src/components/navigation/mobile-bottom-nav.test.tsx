import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileBottomNav } from "./mobile-bottom-nav";

const pathname: { current: string } = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

type TabTitle = "Domů" | "Moduly" | "Profil";

// Active-tab contract edge cases — a naive `pathname.startsWith(url)` (missing
// the trailing "/") would silently match some of these, so pin the behavior.
// Note: `usePathname()` returns only the pathname — query strings never reach
// `isActive` — so inputs like "/moduly?x=1" are impossible and not tested.
const ACTIVE_EDGE_CASES: Array<[string, TabTitle | null]> = [
  ["/modulyx", null], // false-positive guard: must NOT match Moduly
  ["/profilx", null], // false-positive guard: must NOT match Profil
  ["/cteni/prehled", null], // deep non-matching path
  ["/profil/", "Profil"], // trailing slash must not break matching
];

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

  // Each row is its own test, so auto-cleanup runs between rows — every row
  // renders fresh against the updated module-level `pathname`.
  it.each(ACTIVE_EDGE_CASES)(
    "pins the active tab for pathname %s (expected: %s)",
    (currentPath, expected) => {
      pathname.current = currentPath;
      render(<MobileBottomNav />);

      for (const title of ["Domů", "Moduly", "Profil"] as const) {
        if (title === expected) {
          expect(screen.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
        } else {
          expect(screen.getByRole("link", { name: title })).not.toHaveAttribute("aria-current");
        }
      }
    },
  );
});
