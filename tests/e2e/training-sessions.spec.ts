import { expect, test, type BrowserContext } from "@playwright/test"

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedTrainingSession,
  setAuthCookie,
  setBetaCohort,
} from "./fixtures/auth"

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

// The analytics consent banner is fixed to the bottom and covers action buttons.
// It renders on some later re-render (not on load), so pre-record a "declined"
// choice in the browser context instead of racing it.
async function declineAnalyticsConsent(context: BrowserContext): Promise<void> {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ""
  await context.addInitScript(
    ({ key, now }) => {
      localStorage.setItem(`__ph_opt_in_out_${key}`, "0")
      localStorage.setItem("tappka-consent-at", String(now))
    },
    { key: posthogKey, now: Date.now() },
  )
}

test.describe("training sessions", () => {
  test.describe.configure({ mode: "serial" })

  let hostCookie: string
  let guestCookie: string
  let hostTeamId: string
  let hostProfileId: string

  test.beforeAll(async () => {
    const hostTeam = await createTestTeam(1, `E2E TS host ${Date.now()}`)
    const guestTeam = await createTestTeam(2, `E2E TS guest ${Date.now()}`)
    const host = await getSetupSessionCookie(hostTeam)
    const guest = await getSetupSessionCookie(guestTeam)
    for (const user of [host, guest]) {
      await grantBetaAccess(user.profileId)
      await setBetaCohort(user.profileId, "B")
    }
    hostCookie = host.cookie
    guestCookie = guest.cookie
    hostTeamId = hostTeam
    hostProfileId = host.profileId
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test("host creates and publishes, guest joins, host records attendance", async ({ browser }) => {
    const topic = `E2E TS ${Date.now()}`
    const tomorrow = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10)

    const hostContext = await browser.newContext()
    await declineAnalyticsConsent(hostContext)
    await setAuthCookie(hostContext, hostCookie)
    const host = await hostContext.newPage()
    await host.goto("/ts/nova")
    await host.getByLabel("Téma").fill(topic)
    await host.getByLabel("Datum").fill(tomorrow)
    await host.getByLabel("Začátek").fill("08:00")
    await host.getByLabel("Konec").fill("12:00")
    await host.getByLabel("Místa pro jiné týmy").fill("2")
    // A TS needs at least one facilitator; the host facilitates it so they can edit the preparation.
    await host.getByRole("button", { name: "Vytvořit TS" }).click()
    await expect(host.getByText("Vyber aspoň jednu osobu na facilitaci")).toBeVisible()
    await host.getByRole("group", { name: "Facilitace" }).getByRole("button", { name: "E2E Test User" }).click()
    await host.getByRole("button", { name: "Vytvořit TS" }).click()
    await expect(host.getByRole("heading", { name: topic })).toBeVisible()
    const detailUrl = host.url()

    // Příprava is the default tab.
    await expect(host.getByRole("tab", { name: "Příprava" })).toHaveAttribute("aria-selected", "true")
    await expect(host.getByRole("tab", { name: "Přehled" })).toHaveCount(0)
    await host.locator(".ProseMirror").fill("Přečtěte si článek o AI")
    // Saving publishes — there is no draft state.
    await expect(host.getByRole("button", { name: "Zveřejnit" })).toHaveCount(0)
    await host.getByRole("button", { name: "Uložit", exact: true }).click()
    await expect(host.getByText("Příprava uložena")).toBeVisible()

    const guestContext = await browser.newContext()
    await declineAnalyticsConsent(guestContext)
    await setAuthCookie(guestContext, guestCookie)
    const guest = await guestContext.newPage()
    await guest.goto(`/ts/objevovat?q=${encodeURIComponent(topic)}`)
    const card = guest.locator("article", { hasText: topic })
    await expect(card.getByRole("img", { name: "Obsazeno 0 z 2 míst" })).toBeVisible()
    await card.getByRole("button", { name: "Přihlásit se" }).click()
    await expect(card.getByRole("img", { name: "Obsazeno 1 z 2 míst" })).toBeVisible()

    // A guest only gets the preparation, so it is shown directly without tabs.
    await guest.goto(detailUrl)
    await expect(guest.getByRole("heading", { name: "Příprava" })).toBeVisible()
    await expect(guest.getByText("Přečtěte si článek o AI")).toBeVisible()
    await expect(guest.getByRole("tab")).toHaveCount(0)

    await host.reload()
    await host.getByRole("tab", { name: "Docházka" }).click()
    await host.getByRole("button", { name: "Všichni" }).click()
    await host.getByRole("button", { name: "Uložit docházku" }).click()
    await expect(host.getByText("Docházka uložena")).toBeVisible()

    await hostContext.close()
    await guestContext.close()
  })

  test("host writes a reflection after the session has started", async ({ browser }) => {
    const startsAt = new Date(Date.now() - 3 * HOUR_MS).toISOString()
    const endsAt = new Date(Date.now() - 2 * HOUR_MS).toISOString()
    const { sessionId } = await seedTrainingSession(hostTeamId, hostProfileId, { startsAt, endsAt })

    const hostContext = await browser.newContext()
    await declineAnalyticsConsent(hostContext)
    await setAuthCookie(hostContext, hostCookie)
    const host = await hostContext.newPage()
    await host.goto(`/ts/${sessionId}?tab=reflexe`)
    await host.locator(".ProseMirror").fill("Fungovalo to skvěle")
    await host.getByRole("button", { name: "Uložit reflexi" }).click()
    await expect(host.getByText("Reflexe uložena")).toBeVisible()

    await hostContext.close()
  })
})
