import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobilePageTitle, pageTitleFor } from "./mobile-page-title";

const pathname: { current: string } = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("MobilePageTitle", () => {
  it("shows the page title on the home, moduly, and profil hubs", () => {
    pathname.current = "/";
    render(<MobilePageTitle />);
    expect(screen.getByText("Domů")).toBeInTheDocument();

    pathname.current = "/moduly";
    cleanup();
    render(<MobilePageTitle />);
    expect(screen.getByText("Moduly")).toBeInTheDocument();

    pathname.current = "/profil";
    cleanup();
    render(<MobilePageTitle />);
    expect(screen.getByText("Profil")).toBeInTheDocument();
  });

  it("renders nothing on a path with no matching title", () => {
    pathname.current = "/nonsense";
    const { container } = render(<MobilePageTitle />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("pageTitleFor", () => {
  // Longest-prefix contract — a naive first-match lookup would return a
  // shorter (wrong) title for these deep paths.
  it.each([
    ["/komunita/profil/abc", "Komunita"],
    ["/cteni/hledat", "Čtení"],
    ["/settings/notifikace", "Nastavení"],
    ["/reservations/settings", "Místnosti"],
  ])("returns %s for pathname %s", (currentPath, expected) => {
    expect(pageTitleFor(currentPath)).toBe(expected);
  });

  it("returns null for unmatched paths and exact-matches only the root", () => {
    expect(pageTitleFor("/nonsense")).toBeNull();
    expect(pageTitleFor("")).toBeNull();
    expect(pageTitleFor("/profilx")).toBeNull();
    expect(pageTitleFor("/modulyx")).toBeNull();
    expect(pageTitleFor("/")).toBe("Domů");
  });
});