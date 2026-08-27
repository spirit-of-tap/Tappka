import { describe, expect, it } from "vitest";
import { BETA_FEATURES } from "./feature-access";
import type { AccessProfile } from "./feature-access";
import { MODULE_HUB_ORDER, NAV_MODULES, getHubModules } from "./navigation";

const nonBeta: AccessProfile = { role: "student", beta_access_granted_at: null, beta_cohort: "A" };
const cohortA: AccessProfile = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "A" };
const cohortB: AccessProfile = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "B" };
const admin: AccessProfile = { role: "admin", beta_access_granted_at: null, beta_cohort: "A" };

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

  it("marks feature-gated modules", () => {
    expect(NAV_MODULES.filter((m) => m.feature).length).toBeGreaterThan(0);
    expect((NAV_MODULES as unknown as { betaOnly?: boolean }[]).some((m) => (m as unknown as { betaOnly?: boolean }).betaOnly)).toBe(false);
  });

  it("pins the feature urls", () => {
    expect(NAV_MODULES.filter((m) => m.feature).map((m) => m.url)).toEqual([
      "/schuzky",
      "/koucovani",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/nastroje-techniky",
      "/osobnostni-testy",
      "/cteni/prehled",
      "/birth-giving",
    ]);
  });

  it("has no betaOnly property and every feature maps to registry", () => {
    for (const m of NAV_MODULES) {
      expect((m as unknown as Record<string, unknown>).betaOnly).toBeUndefined();
      if (m.feature) {
        expect(BETA_FEATURES[m.feature]).toBeDefined();
      }
    }
  });

  it("maps reading to A,B and others to B only", () => {
    const reading = NAV_MODULES.find((m) => m.url === "/cteni/prehled")!;
    expect(reading.feature).toBe("reading");
    expect(BETA_FEATURES[reading.feature!]).toEqual(["A", "B"]);
    for (const m of NAV_MODULES.filter((m) => m.feature && m.url !== "/cteni/prehled")) {
      expect(BETA_FEATURES[m.feature!]).toEqual(["B"]);
    }
  });

  it("maps each url to its expected feature key", () => {
    const map: Record<string, string> = {
      "/schuzky": "customerMeetings",
      "/koucovani": "coaching",
      "/tymova-reflexe": "teamReflection",
      "/tymovy-denik": "teamDiary",
      "/tymove-dokumenty": "teamDocuments",
      "/nastroje-techniky": "toolsTechniques",
      "/osobnostni-testy": "personalityTests",
      "/cteni/prehled": "reading",
      "/birth-giving": "birthGiving",
    };
    for (const [url, feature] of Object.entries(map)) {
      expect(NAV_MODULES.find((m) => m.url === url)!.feature).toBe(feature);
    }
    for (const m of NAV_MODULES.filter((m) => !m.feature)) {
      expect(["/", "/reservations", "/komunita"]).toContain(m.url);
    }
  });
});

describe("getHubModules", () => {
  it("returns hub cards in visit-frequency order for B cohort", () => {
    expect(getHubModules(cohortB).map((m) => m.url)).toEqual([
      "/cteni/prehled",
      "/reservations",
      "/nastroje-techniky",
      "/schuzky",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/koucovani",
      "/birth-giving",
      "/osobnostni-testy",
    ]);
  });

  it("returns all hub cards for admin regardless of enrollment", () => {
    expect(getHubModules(admin).map((m) => m.url)).toEqual([
      "/cteni/prehled",
      "/reservations",
      "/nastroje-techniky",
      "/schuzky",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/koucovani",
      "/birth-giving",
      "/osobnostni-testy",
    ]);
  });

  it("keeps only non-feature modules for non-beta users, preserving hub order", () => {
    expect(getHubModules(null).map((m) => m.url)).toEqual(["/reservations"]);
    expect(getHubModules(nonBeta).map((m) => m.url)).toEqual(["/reservations"]);
    expect(getHubModules(undefined).map((m) => m.url)).toEqual(["/reservations"]);
  });

  it("shows reading plus stable for cohort A", () => {
    expect(getHubModules(cohortA).map((m) => m.url)).toEqual(["/cteni/prehled", "/reservations"]);
  });

  it("filters by canAccessFeature via cohort", () => {
    expect(getHubModules(cohortA).some((m) => m.url === "/schuzky")).toBe(false);
    expect(getHubModules(cohortB).some((m) => m.url === "/schuzky")).toBe(true);
    expect(getHubModules(cohortA).some((m) => m.url === "/cteni/prehled")).toBe(true);
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
    const featured = getHubModules(cohortB).filter((m) => m.featured);
    expect(featured.map((m) => m.url)).toEqual(["/cteni/prehled", "/reservations", "/nastroje-techniky"]);
  });

  it("supports legacy boolean for backward compatibility", () => {
    expect(getHubModules(true as unknown as AccessProfile).map((m) => m.url)).toEqual([
      "/cteni/prehled",
      "/reservations",
      "/nastroje-techniky",
      "/schuzky",
      "/tymova-reflexe",
      "/tymovy-denik",
      "/tymove-dokumenty",
      "/koucovani",
      "/birth-giving",
      "/osobnostni-testy",
    ]);
    expect(getHubModules(false as unknown as AccessProfile).map((m) => m.url)).toEqual(["/reservations"]);
  });
});
