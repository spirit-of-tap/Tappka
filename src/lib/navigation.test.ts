import { describe, expect, it } from "vitest";
import { MODULE_HUB_ORDER, NAV_MODULES, getHubModules, getModuleForPath } from "./navigation";

describe("navigation config", () => {
  it("contains every module with url, icon and Czech description", () => {
    expect(NAV_MODULES.length).toBeGreaterThanOrEqual(10);
    for (const m of NAV_MODULES) {
      expect(m.url).toMatch(/^\//);
      expect(m.icon).toBeDefined();
      expect(m.description.length).toBeGreaterThan(10);
    }
  });

  it("has unique urls", () => {
    const urls = NAV_MODULES.map((m) => m.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("marks beta-only modules", () => {
    expect(NAV_MODULES.filter((m) => m.betaOnly).length).toBeGreaterThan(0);
  });

  it("pins the beta-only urls", () => {
    expect(NAV_MODULES.filter((m) => m.betaOnly).map((m) => m.url)).toEqual([
      "/schuzky",
      "/koucovani",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/nastroje-techniky",
      "/komunita/profil",
      "/cteni/prehled",
      "/birth-giving",
    ]);
  });
});

describe("getHubModules", () => {
  it("returns hub cards in visit-frequency order for beta users", () => {
    expect(getHubModules(true).map((m) => m.url)).toEqual([
      "/cteni/prehled",
      "/reservations",
      "/nastroje-techniky",
      "/schuzky",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/koucovani",
      "/birth-giving",
      "/komunita/profil",
    ]);
  });

  it("keeps only non-beta modules for non-beta users, preserving hub order", () => {
    expect(getHubModules(false).map((m) => m.url)).toEqual(["/reservations"]);
  });

  it("excludes Dashboard and Komunita (permanent bottom-bar tabs)", () => {
    expect(MODULE_HUB_ORDER).toHaveLength(10);
    expect(MODULE_HUB_ORDER).not.toContain("/");
    expect(MODULE_HUB_ORDER).not.toContain("/komunita");
  });

  // Hub-completeness invariant — a future NAV_MODULES entry must be added to
  // MODULE_HUB_ORDER or this fails, so modules can't silently vanish from the
  // /moduly hub. Only the permanent bottom-bar tabs ("/", "/komunita") are
  // exempt; subroutes like /komunita/profil are regular hub cards.
  it("includes every module route in the hub order exactly once", () => {
    const expected = NAV_MODULES.filter((m) => m.url !== "/" && m.url !== "/komunita")
      .map((m) => m.url)
      .sort();
    expect([...MODULE_HUB_ORDER].sort()).toEqual(expected);
    expect(new Set(MODULE_HUB_ORDER).size).toBe(MODULE_HUB_ORDER.length);
  });

  it("marks exactly the weekly+ modules as featured", () => {
    const featured = getHubModules(true).filter((m) => m.featured);
    expect(featured.map((m) => m.url)).toEqual(["/cteni/prehled", "/reservations", "/nastroje-techniky"]);
  });
});

describe("getModuleForPath", () => {
  it("matches a module by the pathname's first segment", () => {
    expect(getModuleForPath("/cteni/prehled")?.title).toBe("Čtení");
    expect(getModuleForPath("/cteni/knihy/some-id")?.title).toBe("Čtení");
  });

  it("maps subpages to their top-level module", () => {
    // /komunita/* resolves to the Komunita module even though the
    // Osobnostní-testy entry shares its first segment — array order wins.
    expect(getModuleForPath("/komunita/profil")?.title).toBe("Komunita");
  });

  it("returns null for the dashboard root, unknown segments and missing paths", () => {
    expect(getModuleForPath("/")).toBeNull();
    expect(getModuleForPath("/neexistuje/cesta")).toBeNull();
    expect(getModuleForPath(null)).toBeNull();
  });
});
