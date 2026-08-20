import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileBottomNav } from "./mobile-bottom-nav";

const pathname: { current: string } = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

type TabTitle = "Domů" | "Moduly" | "Komunita" | "Profil";

const TAB_TITLES = ["Domů", "Moduly", "Komunita", "Profil"] as const;

function expectActiveTab(expected: TabTitle | null) {
  for (const title of TAB_TITLES) {
    const link = screen.getByRole("link", { name: title });
    if (title === expected) {
      expect(link).toHaveAttribute("aria-current", "page");
    } else {
      expect(link).not.toHaveAttribute("aria-current");
    }
  }
}

// Active-tab contract edge cases — a naive `pathname.startsWith(url)` (missing
// the trailing "/") would silently match some of these, so pin the behavior.
// Note: `usePathname()` returns only the pathname — query strings never reach
// `isActive` — so inputs like "/moduly?x=1" are impossible and not tested.
const ACTIVE_EDGE_CASES: Array<[string, TabTitle | null]> = [
  ["/modulyx", null], // false-positive guard: must NOT match Moduly
  ["/profilx", null], // false-positive guard: must NOT match Profil
  ["/cteni/prehled", "Moduly"], // module route lights up Moduly (section highlighting)
  ["/profil/", "Profil"], // trailing slash must not break matching
];

// Module routes have no tab of their own but light up their owning tab
// (section highlighting).
const SECTION_ACTIVE_CASES: Array<[string, TabTitle]> = [
  ["/reservations", "Moduly"],
  ["/cteni/hledat", "Moduly"],
  ["/birth-giving/event-1", "Moduly"],
  ["/komunita", "Komunita"],
  // Osobnostní testy lives under /komunita/profil, but Komunita owns the space.
  ["/komunita/profil/abc", "Komunita"],
];

// Paths that belong to no bottom-bar tab at all.
const NO_ACTIVE_CASES: Array<[string]> = [
  ["/komunitax"], // false-positive guard: must NOT match Komunita
  ["/settings/notifikace"],
];

describe("MobileBottomNav", () => {
  it("renders all four tabs with correct hrefs", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("href", "/moduly");
    expect(screen.getByRole("link", { name: "Komunita" })).toHaveAttribute("href", "/komunita");
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profil");
  });

  it("marks the active tab on the home page", () => {
    pathname.current = "/";
    render(<MobileBottomNav />);
    expectActiveTab("Domů");
  });

  it("marks the Moduly tab as active on the hub and inside the hub tree", () => {
    pathname.current = "/moduly";
    render(<MobileBottomNav />);
    expectActiveTab("Moduly");

    pathname.current = "/moduly/deep";
    cleanup();
    render(<MobileBottomNav />);
    expectActiveTab("Moduly");
  });

  it("marks the Profil tab as active on the hub", () => {
    pathname.current = "/profil";
    render(<MobileBottomNav />);
    expectActiveTab("Profil");
  });

  // Each row is its own test, so auto-cleanup runs between rows — every row
  // renders fresh against the updated module-level `pathname`.
  it.each(ACTIVE_EDGE_CASES)(
    "pins the active tab for pathname %s (expected: %s)",
    (currentPath, expected) => {
      pathname.current = currentPath;
      render(<MobileBottomNav />);
      expectActiveTab(expected);
    },
  );

  it.each(SECTION_ACTIVE_CASES)(
    "keeps the owning tab active inside %s (expected: %s)",
    (currentPath, expected) => {
      pathname.current = currentPath;
      render(<MobileBottomNav />);
      expectActiveTab(expected);
    },
  );

  it.each(NO_ACTIVE_CASES)("leaves all tabs inactive on %s", (currentPath) => {
    pathname.current = currentPath;
    render(<MobileBottomNav />);
    expectActiveTab(null);
  });
});
