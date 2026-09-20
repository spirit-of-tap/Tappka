import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ROOT_URL = new URL("../..", import.meta.url);
const ROOT = fileURLToPath(ROOT_URL);
const pub = (p: string) => fileURLToPath(new URL(`../../public/${p}`, import.meta.url));
const srcFile = (p: string) => fileURLToPath(new URL(`../../src/${p}`, import.meta.url));

const TAP_RED = { r: 179, g: 27, b: 27 };

interface PixelStats {
  width: number;
  height: number;
  darkOpaque: number;
  lightOpaque: number;
  redOpaque: number;
  pureWhiteOpaque: number;
  transparent: number;
  opaque: number;
}

async function analyze(file: string, step = 7): Promise<PixelStats> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stats: PixelStats = {
    width: info.width,
    height: info.height,
    darkOpaque: 0,
    lightOpaque: 0,
    redOpaque: 0,
    pureWhiteOpaque: 0,
    transparent: 0,
    opaque: 0,
  };
  for (let y = 0; y < info.height; y += step) {
    for (let x = 0; x < info.width; x += step) {
      const i = (y * info.width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a < 16) {
        stats.transparent += 1;
        continue;
      }
      if (a <= 128) continue;
      stats.opaque += 1;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const isRed = r > 100 && r - g > 60 && r - b > 60;
      if (isRed) stats.redOpaque += 1;
      else if (lum < 80) stats.darkOpaque += 1;
      else if (lum > 200) stats.lightOpaque += 1;
      if (r > 250 && g > 250 && b > 250) stats.pureWhiteOpaque += 1;
    }
  }
  return stats;
}

async function cornerPixel(file: string, x: number, y: number) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  void info;
  return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: data[3] ?? 0 };
}

function nearTAPRed(px: { r: number; g: number; b: number }, tolerance = 45) {
  return (
    Math.abs(px.r - TAP_RED.r) <= tolerance &&
    Math.abs(px.g - TAP_RED.g) <= tolerance &&
    Math.abs(px.b - TAP_RED.b) <= tolerance
  );
}

describe("branding assets (issue #152)", () => {
  it("ships a dark-mode TAP logo with light text and preserved red figure", async () => {
    const light = await analyze(pub("tap_logo.png"));
    // Sanity: light logo really is dark-text on transparency.
    expect(light.darkOpaque).toBeGreaterThan(500);
    expect(light.redOpaque).toBeGreaterThan(500);
    expect(light.transparent).toBeGreaterThan(1000);

    const dark = await analyze(pub("tap_logo_dark.png"));
    expect(dark.width).toBe(light.width);
    expect(dark.height).toBe(light.height);
    // Transparent background preserved, black text replaced by light text.
    expect(dark.transparent).toBeGreaterThan(1000);
    expect(dark.darkOpaque).toBe(0);
    expect(dark.lightOpaque).toBeGreaterThan(500);
    expect(dark.redOpaque).toBeGreaterThan(500);
  });

  it("renders theme-aware TAP logos on login and about pages", () => {
    for (const page of ["app/auth/login/page.tsx", "app/about/page.tsx"]) {
      const source = readFileSync(srcFile(page), "utf8");
      expect(source).toContain("/tap_logo.png");
      expect(source).toContain("/tap_logo_dark.png");
      expect(source).toContain("dark:");
    }
    void ROOT;
  });

  it("apple-touch-icon is opaque full-bleed TAP red without white edges", async () => {
    const file = pub("apple-touch-icon.png");
    const meta = await sharp(file).metadata();
    expect(meta.width).toBe(180);
    expect(meta.height).toBe(180);

    const stats = await analyze(file);
    expect(stats.pureWhiteOpaque).toBe(0);
    // No transparent corners on an apple-touch-icon.
    expect(stats.transparent).toBe(0);

    for (const [x, y] of [
      [2, 2],
      [177, 2],
      [2, 177],
      [177, 177],
    ] as const) {
      const px = await cornerPixel(file, x, y);
      expect(px.a).toBeGreaterThan(128);
      expect(nearTAPRed(px)).toBe(true);
    }
  });

  it("any-purpose icons keep transparency and have no white halo", async () => {
    for (const name of ["icons/icon-192.png", "icons/icon-512.png"] as const) {
      const file = pub(name);
      const stats = await analyze(file);
      // Rounded icon on transparency: corners must stay transparent.
      expect(stats.transparent).toBeGreaterThan(10);
      expect(stats.pureWhiteOpaque).toBe(0);
      // The white T glyph itself must survive (off-white, not pure white).
      expect(stats.lightOpaque).toBeGreaterThan(0);
      expect(stats.redOpaque).toBeGreaterThan(100);
    }
  });

  it("maskable icons are opaque full-bleed TAP red without white edges", async () => {
    for (const name of [
      "icons/icon-maskable-192.png",
      "icons/icon-maskable-512.png",
    ] as const) {
      const file = pub(name);
      const stats = await analyze(file, 9);
      expect(stats.pureWhiteOpaque).toBe(0);
      expect(stats.transparent).toBe(0);
      const size = name.includes("192") ? 192 : 512;
      const c = await cornerPixel(file, 2, 2);
      expect(c.a).toBeGreaterThan(128);
      expect(nearTAPRed(c)).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(size);
      expect(meta.height).toBe(size);
    }
  });
});
