import { devices, expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

let cookieValue: string;

test.beforeAll(async () => {
  const { cookie } = await getSetupSessionCookie();
  cookieValue = cookie;
});

test.afterAll(async () => {
  await cleanupTestData();
});

/**
 * Builds a real 3000x2000 PNG in the page (~6 MB, larger than the old server
 * limit) and hands it to the gallery file input, the way choosing a photo does.
 */
const PICK_IMAGE = `(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 3000;
  canvas.height = 2000;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 3000, 2000);
  gradient.addColorStop(0, '#b31b1b');
  gradient.addColorStop(1, '#fcfff7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 3000, 2000);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = 'rgba(0,0,0,' + (i % 7) / 20 + ')';
    ctx.fillRect((i * 137) % 3000, (i * 311) % 2000, 90, 60);
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], 'photo.png', { type: 'image/png' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const inputs = [...document.querySelectorAll('input[type=file]')];
  const input = inputs.find((el) => !el.hasAttribute('capture'));
  if (!input) throw new Error('gallery input not found');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return blob.size;
})()`;

test.describe("essay image upload", () => {
  test("shows the image while it uploads and stores an optimized copy", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);

    let uploadedBytes = 0;
    // Held open so the in-document placeholder is observable rather than a flash.
    await page.route("**/api/essays/upload-image", async (route) => {
      uploadedBytes = route.request().postDataBuffer()?.byteLength ?? 0;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto("/cteni/eseje/nova");
    await page.locator(".ProseMirror").waitFor();
    await page.locator(".ProseMirror").click();

    const originalBytes = Number(await page.evaluate(PICK_IMAGE));

    await expect(page.locator(".ProseMirror img[data-uploading]")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Nahrávám obrázek/)).toBeVisible();

    // The placeholder becomes the stored image, marker gone.
    await expect(page.locator(".ProseMirror img[data-uploading]")).toHaveCount(0, { timeout: 25_000 });
    await expect(page.locator(".ProseMirror img").first()).toHaveAttribute(
      "src",
      /^https?:\/\/.+\.webp$/,
    );

    // Optimization is the point: a 6 MB PNG must not be stored as-is.
    expect(uploadedBytes).toBeGreaterThan(0);
    expect(uploadedBytes).toBeLessThan(originalBytes / 4);
  });

  test("tells the author when an upload fails and removes the placeholder", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);

    await page.route("**/api/essays/upload-image", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Nepodporovaný formát" }),
      }),
    );

    await page.goto("/cteni/eseje/nova");
    await page.locator(".ProseMirror").waitFor();
    await page.locator(".ProseMirror").click();
    await page.evaluate(PICK_IMAGE);

    await expect(page.getByText("Nepodporovaný formát")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".ProseMirror img")).toHaveCount(0);
  });

  test("never autosaves a blob URL for an upload still in flight", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);

    // Never resolves: the placeholder stays in the document across several
    // autosave cycles, which is exactly when a blob URL could leak into the DB.
    await page.route("**/api/essays/upload-image", () => {});

    const savedBodies: string[] = [];
    page.on("request", (request) => {
      const method = request.method();
      if ((method === "POST" || method === "PATCH") && request.url().includes("/api/essays")) {
        savedBodies.push(request.postData() ?? "");
      }
    });

    await page.goto("/cteni/eseje/nova");
    await page.locator(".ProseMirror").waitFor();
    await page.getByLabel("Název eseje").fill("Esej s obrázkem");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Text před obrázkem.");
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 20_000 });

    await page.evaluate(PICK_IMAGE);
    await expect(page.locator(".ProseMirror img[data-uploading]")).toBeVisible({ timeout: 15_000 });

    // Keep typing so autosave definitely runs with the placeholder present.
    await page.locator(".ProseMirror").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" A ještě text po obrázku.");
    await page.waitForResponse(
      (res) => res.url().includes("/api/essays/") && res.request().method() === "PATCH",
      { timeout: 20_000 },
    );

    expect(savedBodies.length).toBeGreaterThan(0);
    for (const body of savedBodies) {
      expect(body).not.toContain("blob:");
    }

    // The text either side of the pending image is still saved.
    const lastBody = savedBodies.at(-1) ?? "";
    expect(lastBody).toContain("Text před obrázkem.");
  });
});

// Everything but the browser choice: the project runs Chromium, and
// defaultBrowserType cannot be overridden inside a describe.
const { defaultBrowserType: _browser, ...IPHONE } = devices["iPhone 13"];

test.describe("essay image upload on a phone", () => {
  // Touch emulation makes `(pointer: coarse)` match, which is what gates the
  // camera option — a laptop keeps the plain single button.
  test.use(IPHONE);

  test("offers taking a new photo, not just picking from the gallery", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");
    await page.locator(".ProseMirror").waitFor();

    await page.getByTitle("Vložit obrázek").click();
    await expect(page.getByRole("menuitem", { name: "Vyfotit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Vybrat obrázek" })).toBeVisible();

    // The camera input is what actually opens the camera rather than the picker.
    await expect(page.locator('input[type=file][capture]')).toHaveAttribute(
      "capture",
      "environment",
    );
  });
});
