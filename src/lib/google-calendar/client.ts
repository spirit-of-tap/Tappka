/**
 * Minimal Google Calendar v3 client for Tappka's robot (service) account.
 * The team shares its calendar with the robot's e-mail; no user OAuth involved.
 * Server-only: holds the service-account private key — never import from client components.
 */
import { createSign } from "node:crypto"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events"
const JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer"
const ASSERTION_LIFETIME_SECONDS = 3600
/** Refresh the access token this long before Google says it expires. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000
const MS_PER_SECOND = 1000

const HTTP_NOT_FOUND = 404
const HTTP_GONE = 410

export interface ServiceAccount {
  email: string
  privateKey: string
}

export type CalendarAccessRole = "none" | "freeBusyReader" | "reader" | "writer" | "owner"

export interface CalendarAccess {
  name: string
  accessRole: CalendarAccessRole
}

export interface CalendarEventBody {
  summary: string
  description?: string
  location?: string
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
  source?: { title: string; url: string }
}

export class GoogleCalendarError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "GoogleCalendarError"
  }
}

/** Reads the robot account from env; `null` when the sync is not set up on this deployment. */
export function readServiceAccount(env: Record<string, string | undefined> = process.env): ServiceAccount | null {
  const email = env.GOOGLE_CALENDAR_SA_EMAIL?.trim()
  const rawKey = env.GOOGLE_CALENDAR_SA_PRIVATE_KEY
  if (!email || !rawKey) return null
  // Env UIs (Vercel, .env files) often store the PEM with literal "\n".
  return { email, privateKey: rawKey.replace(/\\n/g, "\n") }
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url")
}

export class GoogleCalendarClient {
  private token: { value: string; expiresAt: number } | null = null

  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get robotEmail(): string {
    return this.account.email
  }

  /** Calendar name and what the robot may do with it. Throws 404 when the calendar is not shared. */
  async getAccess(calendarId: string): Promise<CalendarAccess> {
    // events.list carries the calendar summary and the caller's accessRole and only needs the events scope.
    const body = await this.request<{ summary?: string; accessRole?: CalendarAccessRole }>(
      "GET",
      `${this.eventsPath(calendarId)}?maxResults=1`,
    )
    return { name: body?.summary ?? calendarId, accessRole: body?.accessRole ?? "none" }
  }

  /** Creates or updates the event with a fixed id; also revives a previously deleted one. */
  async upsertEvent(calendarId: string, eventId: string, event: CalendarEventBody): Promise<void> {
    const body = { ...event, id: eventId, status: "confirmed" }
    try {
      await this.request("PUT", `${this.eventsPath(calendarId)}/${eventId}`, body)
    } catch (error) {
      if (!(error instanceof GoogleCalendarError) || error.status !== HTTP_NOT_FOUND) throw error
      await this.request("POST", this.eventsPath(calendarId), body)
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.request("DELETE", `${this.eventsPath(calendarId)}/${eventId}`)
    } catch (error) {
      if (error instanceof GoogleCalendarError && (error.status === HTTP_NOT_FOUND || error.status === HTTP_GONE)) return
      throw error
    }
  }

  private eventsPath(calendarId: string): string {
    return `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T | null> {
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    const parsed: unknown = text ? JSON.parse(text) : null
    if (!response.ok) {
      const message = (parsed as { error?: { message?: string } } | null)?.error?.message ?? response.statusText
      throw new GoogleCalendarError(response.status, message)
    }
    return parsed as T | null
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value
    const now = Math.floor(Date.now() / MS_PER_SECOND)
    const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
      JSON.stringify({ iss: this.account.email, scope: EVENTS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + ASSERTION_LIFETIME_SECONDS }),
    )}`
    const signature = createSign("RSA-SHA256").update(unsigned).sign(this.account.privateKey).toString("base64url")

    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: JWT_GRANT_TYPE, assertion: `${unsigned}.${signature}` }).toString(),
    })
    const data = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string }
    if (!response.ok || !data.access_token) {
      throw new GoogleCalendarError(response.status, data.error_description ?? "Robot account sign-in failed")
    }
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? ASSERTION_LIFETIME_SECONDS) * MS_PER_SECOND - TOKEN_EXPIRY_MARGIN_MS,
    }
    return this.token.value
  }
}

/** Client for this deployment, or `null` when the robot account env is missing. */
export function createGoogleCalendarClient(): GoogleCalendarClient | null {
  const account = readServiceAccount()
  return account ? new GoogleCalendarClient(account) : null
}
