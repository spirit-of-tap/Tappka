import { createVerify, generateKeyPairSync } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { GoogleCalendarClient, GoogleCalendarError, readServiceAccount } from "./client"

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
})
const ACCOUNT = { email: "robot@tappka.iam.gserviceaccount.com", privateKey }
const CALENDAR = "team@group.calendar.google.com"

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
const token = () => json(200, { access_token: "tok", expires_in: 3600 })

describe("readServiceAccount", () => {
  it("is null until both env values are set, and unescapes \\n in the key", () => {
    expect(readServiceAccount({})).toBeNull()
    expect(readServiceAccount({ GOOGLE_CALENDAR_SA_EMAIL: "a@b" })).toBeNull()
    expect(readServiceAccount({ GOOGLE_CALENDAR_SA_EMAIL: "a@b", GOOGLE_CALENDAR_SA_PRIVATE_KEY: "x\\ny" })).toEqual({
      email: "a@b",
      privateKey: "x\ny",
    })
  })
})

describe("GoogleCalendarClient", () => {
  const fetchMock = vi.fn<typeof fetch>()
  let client: GoogleCalendarClient

  beforeEach(() => {
    fetchMock.mockReset()
    client = new GoogleCalendarClient(ACCOUNT, fetchMock)
  })

  it("signs a valid RS256 service-account assertion for the events scope and reuses the token", async () => {
    fetchMock.mockResolvedValueOnce(token()).mockImplementation(async () => json(200, { summary: "Tým", accessRole: "writer" }))
    await client.getAccess(CALENDAR)
    await client.getAccess(CALENDAR)

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"))
    expect(tokenCalls).toHaveLength(1)
    const assertion = new URLSearchParams(String(tokenCalls[0][1]?.body)).get("assertion") ?? ""
    const [header, payload, signature] = assertion.split(".")
    const verifier = createVerify("RSA-SHA256")
    verifier.update(`${header}.${payload}`)
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true)
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString())
    expect(claims).toMatchObject({ iss: ACCOUNT.email, scope: "https://www.googleapis.com/auth/calendar.events" })
  })

  it("reports the calendar name and access role", async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json(200, { summary: "Tým Alfa", accessRole: "reader" }))
    await expect(client.getAccess(CALENDAR)).resolves.toEqual({ name: "Tým Alfa", accessRole: "reader" })
    expect(String(fetchMock.mock.calls[1][0])).toContain(encodeURIComponent(CALENDAR))
  })

  it("upserts: updates an existing event, inserts when it does not exist yet", async () => {
    fetchMock
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(json(404, { error: { code: 404, message: "Not Found" } }))
      .mockResolvedValueOnce(json(200, { id: "abc12" }))
    await client.upsertEvent(CALENDAR, "abc12", { summary: "TS" })
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT")
    expect(fetchMock.mock.calls[2][1]?.method).toBe("POST")
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ id: "abc12", status: "confirmed" })
  })

  it("treats deleting a missing or already deleted event as done", async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json(410, { error: { code: 410 } }))
    await expect(client.deleteEvent(CALENDAR, "abc12")).resolves.toBeUndefined()
  })

  it("throws a typed error with the HTTP status", async () => {
    fetchMock.mockResolvedValueOnce(token()).mockResolvedValueOnce(json(403, { error: { code: 403, message: "Forbidden" } }))
    await expect(client.deleteEvent(CALENDAR, "abc12")).rejects.toMatchObject({ status: 403 })
    fetchMock.mockResolvedValueOnce(json(403, { error: { code: 403, message: "Forbidden" } }))
    await expect(client.deleteEvent(CALENDAR, "abc12")).rejects.toBeInstanceOf(GoogleCalendarError)
  })
})
