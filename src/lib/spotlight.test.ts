import { describe, expect, it } from "vitest";

import {
  getSpotlightItems,
  normalizeSearchString,
  scoreSpotlightSearch,
  RAW_SPOTLIGHT_ITEMS,
} from "./spotlight";

describe("spotlight", () => {
  it("defines valid raw spotlight items", () => {
    expect(RAW_SPOTLIGHT_ITEMS.length).toBeGreaterThan(12);
    for (const item of RAW_SPOTLIGHT_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(item.keywords.length).toBeGreaterThan(0);
    }
  });

  describe("scoreSpotlightSearch (natural user search intents)", () => {
    const items = getSpotlightItems({
      user: { id: "user-1", beta_access: true, role: "admin" },
    });
    const cteni = items.find((i) => i.id === "page-cteni")!;
    const mistnosti = items.find((i) => i.id === "page-reservations")!;
    const schuzky = items.find((i) => i.id === "page-schuzky")!;
    const profil = items.find((i) => i.id === "profile-me")!;

    it("matches 'chci napsat novou esej' and 'napsat novou eseje' to Čtení a knihovna with high score", () => {
      expect(scoreSpotlightSearch(cteni, "chci napsat novou esej")).toBeGreaterThan(100);
      expect(scoreSpotlightSearch(cteni, "napsat novou eseje")).toBeGreaterThan(100);
    });

    it("matches 'chci kde napsat eseje' to Čtení a knihovna with high score", () => {
      expect(scoreSpotlightSearch(cteni, "chci kde napsat eseje")).toBeGreaterThan(100);
    });

    it("matches 'knihy' and 'pujcit knihu' to Čtení a knihovna", () => {
      expect(scoreSpotlightSearch(cteni, "knihy")).toBeGreaterThan(100);
      expect(scoreSpotlightSearch(cteni, "pujcit knihu")).toBeGreaterThan(100);
    });

    it("matches 'zarezervovat mistnost' and 'volna mistnost' to Místnosti", () => {
      expect(scoreSpotlightSearch(mistnosti, "zarezervovat mistnost")).toBeGreaterThan(100);
      expect(scoreSpotlightSearch(mistnosti, "volna mistnost")).toBeGreaterThan(100);
    });

    it("matches 'zákaznické schůzky' and 'nova schuzka' to Zákaznické schůzky", () => {
      expect(scoreSpotlightSearch(schuzky, "zákaznické schůzky")).toBeGreaterThan(100);
      expect(scoreSpotlightSearch(schuzky, "nova schuzka")).toBeGreaterThan(100);
    });

    it("matches 'upravit profil' and 'moje udaje' to Můj profil", () => {
      expect(scoreSpotlightSearch(profil, "upravit profil")).toBeGreaterThan(100);
      expect(scoreSpotlightSearch(profil, "moje udaje")).toBeGreaterThan(100);
    });

    it("returns 0 when no query tokens match", () => {
      expect(scoreSpotlightSearch(cteni, "kosmicka lod astronaut")).toBe(0);
    });

    it("returns 1 on empty search string (shows all)", () => {
      expect(scoreSpotlightSearch(cteni, "")).toBe(1);
      expect(scoreSpotlightSearch(cteni, "   ")).toBe(1);
    });
  });

  describe("normalizeSearchString", () => {
    it("strips Czech diacritics and converts to lowercase", () => {
      expect(normalizeSearchString("Čtení")).toBe("cteni");
      expect(normalizeSearchString("Místnosti a zasedačky")).toBe("mistnosti a zasedacky");
      expect(normalizeSearchString("KOUČOVÁNÍ")).toBe("koucovani");
      expect(normalizeSearchString("   přehled   ")).toBe("prehled");
    });
  });

  describe("getSpotlightItems", () => {
    it("filters out beta items when user does not have beta access", () => {
      const nonBetaItems = getSpotlightItems({
        user: { id: "user-1", beta_access: false },
      });

      const betaItems = nonBetaItems.filter((i) => i.betaOnly);
      expect(betaItems).toHaveLength(0);
      expect(nonBetaItems.some((i) => i.id === "page-dashboard")).toBe(true);
      expect(nonBetaItems.some((i) => i.id === "page-cteni")).toBe(false);
    });

    it("includes beta items when user has beta access", () => {
      const betaItems = getSpotlightItems({
        user: { id: "user-1", beta_access: true },
      });

      expect(betaItems.some((i) => i.id === "page-cteni")).toBe(true);
      expect(betaItems.some((i) => i.id === "page-schuzky")).toBe(true);
      expect(betaItems.some((i) => i.id === "page-koucovani")).toBe(true);
    });

    it("respects coach and admin role gates for room settings", () => {
      const studentItems = getSpotlightItems({
        user: { id: "user-1", role: "student", beta_access: true },
      });
      expect(studentItems.some((i) => i.id === "page-reservation-settings")).toBe(false);

      const coachItems = getSpotlightItems({
        user: { id: "user-2", role: "coach", beta_access: true },
      });
      expect(coachItems.some((i) => i.id === "page-reservation-settings")).toBe(true);

      const adminItems = getSpotlightItems({
        user: { id: "user-3", role: "admin", beta_access: true },
      });
      expect(adminItems.some((i) => i.id === "page-reservation-settings")).toBe(true);
    });

    it("links profile item directly to user profile id when user is provided", () => {
      const items = getSpotlightItems({
        user: { id: "custom-user-123" },
      });

      const profileItem = items.find((i) => i.id === "profile-me");
      expect(profileItem?.url).toBe("/komunita/profil/custom-user-123");
    });
  });
});
