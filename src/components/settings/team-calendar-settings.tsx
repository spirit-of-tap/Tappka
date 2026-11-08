"use client"

import { AlertCircle, CalendarCheck, Check, Copy, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { useCopy } from "@/components/komunitni-kasa/use-copy"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { formatDayHeading, formatTime } from "@/lib/training-sessions/format"

const CALENDAR_API = "/api/training-sessions/calendar"
const RETRY_API = `${CALENDAR_API}/retry`
const TEAM_SEARCH_PARAM = "tym"
const GENERIC_ERROR = "Akci se nepodařilo dokončit. Zkus to prosím znovu."

export interface CalendarSyncFailure {
  sessionId: string
  topic: string
  startsAt: string
  errorMessage: string | null
}

export interface TeamCalendarConnection {
  calendarId: string
  calendarName: string
  lastSyncedAt: string | null
  failures: CalendarSyncFailure[]
}

interface TeamOption {
  id: string
  name: string
}

interface TeamCalendarSettingsProps {
  team: TeamOption
  /** All teams for coaches/admins (team picker); `null` for team members. */
  teams: TeamOption[] | null
  /** Robot account address; `null` when the sync is not configured on this deployment. */
  robotEmail: string | null
  connection: TeamCalendarConnection | null
}

function formatMoment(iso: string): string {
  return `${formatDayHeading(iso)}, ${formatTime(iso)}`
}

interface SyncResult {
  synced: number
  failed: number
}

type ApiResult<T> = { ok: true; data: T | null } | { ok: false; error: string }

async function requestApi<T>(url: string, method: "POST" | "DELETE", body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = (await response.json().catch(() => null)) as { data?: T; error?: string } | null
    if (response.ok) return { ok: true, data: json?.data ?? null }
    return { ok: false, error: json?.error ?? GENERIC_ERROR }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

async function callApi(url: string, method: "POST" | "DELETE", body: unknown): Promise<string | null> {
  const result = await requestApi(url, method, body)
  return result.ok ? null : result.error
}

function describeSyncResult({ synced, failed }: SyncResult): string {
  if (synced === 0 && failed === 0) return "Žádná nadcházející TS k propsání."
  const done = `Propsáno TS: ${synced}.`
  return failed > 0 ? `${done} Nepovedlo se: ${failed}.` : done
}

export function TeamCalendarSettings({ team, teams, robotEmail, connection }: TeamCalendarSettingsProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {teams && (
        <Field className="max-w-xs">
          <FieldLabel htmlFor="team-calendar-team">Tým</FieldLabel>
          <Select value={team.id} onValueChange={(id) => router.push(`?${TEAM_SEARCH_PARAM}=${id}`)}>
            <SelectTrigger id="team-calendar-team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {connection ? (
        <ConnectedCalendar teamId={team.id} connection={connection} />
      ) : (
        <ConnectCalendar teamId={team.id} robotEmail={robotEmail} />
      )}
    </div>
  )
}

function ConnectCalendar({ teamId, robotEmail }: { teamId: string; robotEmail: string | null }) {
  const router = useRouter()
  const { copy, copied } = useCopy()
  const [calendarId, setCalendarId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const failure = await callApi(CALENDAR_API, "POST", { teamId, calendarId: calendarId.trim() })
    setPending(false)
    if (failure) {
      setError(failure)
      return
    }
    toast.success("Kalendář je propojený. Nadcházející TS se do něj právě propisují.")
    router.refresh()
  }

  return (
    <div className="space-y-6 rounded-xl border bg-card p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold">Propoj kalendář týmu</h2>
        <p className="text-sm text-muted-foreground">
          Tappka pak sama zapisuje vaše TS do sdíleného Google Kalendáře týmu: nové, změněné i zrušené.
        </p>
      </div>

      {!robotEmail && (
        <Alert>
          <AlertCircle />
          <AlertTitle className="line-clamp-none">Synchronizace zatím není na Tappce nastavená</AlertTitle>
          <AlertDescription>Chybí robot účet Tappky. Ozvi se správě Tappky.</AlertDescription>
        </Alert>
      )}

      <ol className="list-decimal space-y-3 pl-5 text-sm marker:text-muted-foreground">
        <li>V Google Kalendáři otevři u kalendáře týmu Nastavení a sdílení → Sdílet s konkrétními lidmi → Přidat lidi.</li>
        <li className="space-y-2">
          <span>Přidej robota Tappky:</span>
          {robotEmail && (
            <span className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-md bg-muted px-2 py-1 text-xs">{robotEmail}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => copy(robotEmail)}>
                {copied === robotEmail ? <Check /> : <Copy />}
                {copied === robotEmail ? "Zkopírováno" : "Kopírovat"}
              </Button>
            </span>
          )}
        </li>
        <li>
          Nastav oprávnění <strong className="font-medium">Provádět změny událostí</strong> a ulož.
        </li>
        <li>V části Integrace kalendáře zkopíruj ID kalendáře a vlož ho sem.</li>
      </ol>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="team-calendar-id">ID kalendáře</FieldLabel>
          <Input
            id="team-calendar-id"
            value={calendarId}
            onChange={(event) => setCalendarId(event.target.value)}
            placeholder="…@group.calendar.google.com"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            required
          />
          {error ? <FieldError>{error}</FieldError> : <FieldDescription>Tappka hned ověří, že má ke kalendáři přístup.</FieldDescription>}
        </Field>
        <Button type="submit" disabled={!robotEmail || pending}>
          {pending && <Spinner />}
          Propojit
        </Button>
      </form>
    </div>
  )
}

function ConnectedCalendar({ teamId, connection }: { teamId: string; connection: TeamCalendarConnection }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleSync() {
    setSyncing(true)
    const result = await requestApi<SyncResult>(RETRY_API, "POST", { teamId })
    setSyncing(false)
    if (!result.ok) toast.error(result.error)
    else if (result.data) toast[result.data.failed > 0 ? "error" : "success"](describeSyncResult(result.data))
    router.refresh()
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    const failure = await callApi(CALENDAR_API, "DELETE", { teamId })
    setDisconnecting(false)
    if (failure) {
      toast.error(failure)
      return
    }
    toast.success("Kalendář je odpojený.")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 gap-3">
          <CalendarCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{connection.calendarName}</p>
            <p className="break-all text-xs text-muted-foreground">{connection.calendarId}</p>
            <p className="text-sm text-muted-foreground">
              {connection.lastSyncedAt
                ? `Naposledy synchronizováno ${formatMoment(connection.lastSyncedAt).toLocaleLowerCase("cs-CZ")}`
                : "Zatím se nepropsala žádná TS"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Spinner /> : <RefreshCw />}
            Synchronizovat teď
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={disconnecting}>
                Odpojit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odpojit kalendář týmu?</AlertDialogTitle>
                <AlertDialogDescription>
                  TS se přestanou do kalendáře propisovat. Události, které už v něm jsou, tam zůstanou.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>Odpojit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {connection.failures.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {connection.failures.length === 1 ? "1 TS se nepodařilo propsat" : `TS, které se nepodařilo propsat: ${connection.failures.length}`}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <ul className="space-y-2">
              {connection.failures.map((failure) => (
                <li key={failure.sessionId}>
                  <span className="font-medium text-foreground">{failure.topic}</span>
                  <span className="text-muted-foreground"> · {formatMoment(failure.startsAt)}</span>
                  {failure.errorMessage && <span className="block text-xs">{failure.errorMessage}</span>}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Spinner /> : <RefreshCw />}
              Zkusit znovu
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
