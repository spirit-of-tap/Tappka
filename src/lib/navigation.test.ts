import { describe, expect, it } from "vitest";
import { NAV_MODULES, getVisibleModules } from "./navigation";

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

  it("hides beta modules for non-beta users and shows all for beta users", () => {
    expect(getVisibleModules(true).map((m) => m.url)).toEqual([
      "/",
      "/reservations",
      "/komunita",
      "/schuzky",
      "/koucovani",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/nastroje-techniky",
      "/komunita/profil",
      "/cteni/prehled",
      "/birth-giving",
    ]);
    expect(getVisibleModules(false).map((m) => m.url)).toEqual(["/", "/reservations", "/komunita"]);
  });

  it("pins the beta-only urls", () => {
    expect(NAV_MODULES.filter((m) => m.betaOnly).map((m) => m.url)).toEqual([
      "/schuzky",
      "/koucovani",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/nastroje-techniky",
      "/komunita/profil",
      "/cteni/prehled",
      "/birth-giving",
    ]);
  });
});