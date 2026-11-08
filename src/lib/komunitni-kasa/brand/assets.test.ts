import { describe, it, expect } from "vitest";

import {
  buildSvgDocument,
  escapeSvgText,
  KASA_ASSETS,
  rolePosterAsset,
  stickerSheetAsset,
  STICKER_SHEET,
  wrapLines,
  type FontFamily,
  type KasaAsset,
} from "./assets";
import { KASA_MARK_SEGMENTS_PATH } from "./constants";

const EMPTY_POSTER = { role: "", kdo: "", druzstvo: "", obdobi: "", napln: "" };

function byId(id: string): KasaAsset {
  const asset = KASA_ASSETS.find((a) => a.id === id);
  if (!asset) throw new Error(`missing ${id}`);
  return asset;
}

describe("brand assets", () => {
  it("mark path matches the manual", () => {
    expect(KASA_MARK_SEGMENTS_PATH.startsWith("M30.56 8.31A46 46 0 0 1 69.44 8.31")).toBe(true);
  });

  it("exposes the nine manual assets in order", () => {
    expect(KASA_ASSETS.map((a) => a.id)).toEqual([
      "logo",
      "logo-bile",
      "sestava",
      "samolepka",
      "tkany",
      "odznak",
      "odznak-tmavy",
      "prispevek",
      "banner",
    ]);
  });

  it("sticker is 60×25 mm and woven label 40×15 mm", () => {
    expect(byId("samolepka").mm).toEqual([60, 25]);
    expect(byId("tkany").mm).toEqual([40, 15]);
  });

  it("buildSvgDocument sets mm size when the asset has mm and px otherwise", () => {
    expect(buildSvgDocument(byId("samolepka"))).toContain('width="60mm" height="25mm"');
    expect(buildSvgDocument(byId("banner"))).toContain('width="1920" height="600"');
    expect(buildSvgDocument(byId("banner"))).toContain('viewBox="0 0 1920 600"');
  });

  it("buildSvgDocument embeds font css only when given", () => {
    expect(buildSvgDocument(byId("sestava"))).not.toContain("<style>");
    expect(buildSvgDocument(byId("sestava"), "@font-face{}")).toContain("<style>@font-face{}</style>");
  });

  it("escapeSvgText escapes & < > \" '", () => {
    expect(escapeSvgText(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
    expect(escapeSvgText("it's")).toBe("it&#39;s");
  });

  it("wrapLines wraps at word boundaries, keeps paragraphs, caps lines", () => {
    expect(wrapLines("a ".repeat(200), 48, 6)).toHaveLength(6);
    expect(wrapLines("první\ndruhý", 48, 6)).toEqual(["první", "druhý"]);
    expect(wrapLines("", 48, 6)).toEqual([]);
  });

  it("wrapLines hard-splits a single word longer than maxChars", () => {
    const lines = wrapLines("x".repeat(100), 48, 6);
    expect(lines.every((l) => l.length <= 48)).toBe(true);
    expect(lines.join("")).toBe("x".repeat(100));
  });

  it("role poster escapes user input", () => {
    const body = rolePosterAsset({ ...EMPTY_POSTER, role: "<script>", kdo: "A & B" }).body();
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
    expect(body).toContain("A &amp; B");
  });

  it("role poster caps náplň at six lines", () => {
    const napln = Array.from({ length: 10 }, (_, i) => `řádek ${i}`).join("\n");
    const body = rolePosterAsset({ ...EMPTY_POSTER, napln }).body();
    expect(body).toContain("řádek 5");
    expect(body).not.toContain("řádek 6");
  });

  it("role poster is A4", () => {
    const poster = rolePosterAsset(EMPTY_POSTER);
    expect(poster.id).toBe("plakat");
    expect(poster.mm).toEqual([210, 297]);
    expect([poster.width, poster.height, poster.pngWidth]).toEqual([840, 1188, 2480]);
  });

  it("sticker sheet places 30 stickers on A4", () => {
    const sheet = stickerSheetAsset();
    expect(sheet.mm).toEqual([210, 297]);
    expect(sheet.body().match(/data-sticker/g)).toHaveLength(STICKER_SHEET.columns * STICKER_SHEET.rows);
  });

  it("every asset that renders text declares its fonts", () => {
    const all = [...KASA_ASSETS, rolePosterAsset(EMPTY_POSTER), stickerSheetAsset()];
    for (const asset of all) {
      const body = asset.body();
      for (const family of ["Poppins", "Roboto"] as FontFamily[]) {
        if (body.includes(`font-family="${family}"`)) expect(asset.fonts, asset.id).toContain(family);
      }
    }
  });
});

describe("buildSvgPreview", () => {
  it("is a labelled, responsive image on a light backdrop", async () => {
    const { buildSvgPreview } = await import("./assets");
    const { KASA_COLORS } = await import("./constants");
    const svg = buildSvgPreview(byId("sestava"));
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Sestava s textem"');
    expect(svg).not.toMatch(/^<svg[^>]* width="/);
    expect(svg).toContain(`fill="${KASA_COLORS.WHITE}"`);
  });

  it("uses a dark backdrop for white assets", async () => {
    const { buildSvgPreview } = await import("./assets");
    const { KASA_COLORS } = await import("./constants");
    expect(buildSvgPreview(byId("logo-bile"))).toContain(`fill="${KASA_COLORS.INK}"`);
  });

  it("escapes the label", async () => {
    const { buildSvgPreview } = await import("./assets");
    expect(buildSvgPreview(byId("logo"), 'a "b"')).toContain('aria-label="a &quot;b&quot;"');
  });
});

describe("buildSvgPreview aspect", () => {
  it("expands the viewBox to the requested aspect ratio so the backdrop fills the tile", async () => {
    const { buildSvgPreview } = await import("./assets");
    for (const id of ["logo", "banner", "sestava"]) {
      const svg = buildSvgPreview(byId(id), undefined, 4 / 3);
      const [, , w, h] = svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
      expect(w / h).toBeCloseTo(4 / 3, 5);
    }
  });
});

describe("buildSvgPreview full pages", () => {
  it("adds no margin around A4 pages so the paper edge is the asset edge", async () => {
    const { buildSvgPreview } = await import("./assets");
    for (const asset of [rolePosterAsset(EMPTY_POSTER), stickerSheetAsset()]) {
      expect(buildSvgPreview(asset)).toContain(`viewBox="0 0 ${asset.width} ${asset.height}"`);
    }
  });
});

describe("role poster long input", () => {
  const LONG = "Koordinace společných akcí a klubovny TAP";

  it("squeezes a long role, name and period into their columns", () => {
    const body = rolePosterAsset({ ...EMPTY_POSTER, role: LONG, kdo: "Anna-Marie Dvořáková-Nováková", obdobi: "1. 9. 2026 – 31. 8. 2027" }).body();
    expect(body).toMatch(/textLength="700"[^>]*>Koordinace/);
    expect(body).toMatch(/textLength="370"[^>]*>Anna-Marie/);
    expect(body).toMatch(/textLength="300"[^>]*>1\. 9\./);
  });

  it("leaves short fields untouched", () => {
    const body = rolePosterAsset({ ...EMPTY_POSTER, role: "Klubovna", kdo: "Alex", obdobi: "2026" }).body();
    expect(body).not.toContain("textLength");
  });

  it("marks a trimmed náplň with an ellipsis", () => {
    const napln = Array.from({ length: 10 }, (_, i) => `řádek ${i}`).join("\n");
    expect(rolePosterAsset({ ...EMPTY_POSTER, napln }).body()).toContain("řádek 5…");
    expect(rolePosterAsset({ ...EMPTY_POSTER, napln: "krátká náplň" }).body()).not.toContain("…");
  });
});
