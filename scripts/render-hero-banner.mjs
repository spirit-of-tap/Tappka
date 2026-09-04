/**
 * Renders the README hero banner from hero-banner-template.html.
 *
 *   node scripts/render-hero-banner.mjs
 *
 * The template uses two local assets: public/pef_logo/CZU_PEF_cerna_RGB.png and
 * .github/assets/tap-mark.png — the Tiimiakatemia figure isolated from
 * public/tap_logo.png by keeping only its red strokes (r - max(g, b) > 40) and
 * cropping to the result's bounding box.
 */
import { chromium } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BANNER_WIDTH = 1440;
const BANNER_HEIGHT = 440;
const DEVICE_SCALE_FACTOR = 2; // retina

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "hero-banner-template.html");
const outPath = resolve(__dirname, "../.github/assets/hero-banner.png");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: BANNER_WIDTH, height: BANNER_HEIGHT },
  deviceScaleFactor: DEVICE_SCALE_FACTOR,
});

await page.goto(`file://${htmlPath}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: outPath, type: "png", omitBackground: true });
await browser.close();

console.log(`Rendered hero banner to: ${outPath}`);
