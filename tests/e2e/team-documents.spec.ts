import { expect, test } from "@playwright/test"

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
} from "./fixtures/auth"

const FIRST_PDF = {
  name: "pravidla-v1.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 first team document"),
}

const SECOND_PDF = {
  name: "pravidla-v2.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 second team document"),
}

test.describe("týmové dokumenty - bez přihlášení", () => {
  test("přesměrují na přihlášení", async ({ page }) => {
    await page.goto("/tymove-dokumenty")
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe("týmové dokumenty - členství v týmu", () => {
  test.describe.configure({ mode: "serial" })

  let cookieValue: string

  test.beforeAll(async () => {
    const teamId = await createTestTeam()
    const user = await getSetupSessionCookie(teamId)
    await grantBetaAccess(user.profileId)
    cookieValue = user.cookie
  })

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue)
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test("zobrazí oba zvýrazněné dokumenty a prázdnou vlastní sekci", async ({ page }) => {
    await page.goto("/tymove-dokumenty")

    await expect(page.getByRole("heading", { name: "Týmové dokumenty" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Týmová smlouva" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Finanční směrnice" })).toBeVisible()
    await expect(page.getByText("Zatím žádné další dokumenty")).toBeVisible()
  })

  test("vytvoří vlastní dokument a přidá druhou verzi", async ({ page }) => {
    const title = `E2E pravidla ${Date.now()}`
    await page.goto("/tymove-dokumenty")

    await page.getByRole("button", { name: "Přidat dokument" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByLabel("Název dokumentu").fill(title)
    await dialog.getByLabel("Soubor PDF").setInputFiles(FIRST_PDF)
    await dialog.getByRole("button", { name: "Nahrát verzi" }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await expect(page.getByText("pravidla-v1.pdf")).toBeVisible()

    await page.getByRole("button", { name: "Nahrát novou verzi" }).click()
    dialog = page.getByRole("dialog")
    await dialog.getByLabel("Soubor PDF").setInputFiles(SECOND_PDF)
    await dialog.getByRole("button", { name: "Nahrát verzi" }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByText("pravidla-v2.pdf").first()).toBeVisible()
    await expect(page.getByText("Historie verzí (2)")).toBeVisible()
  })
})
