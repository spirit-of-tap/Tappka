import { formatDayHeading, formatTimeRange } from "./format"

export interface TeamsMessageInput {
  topic: string
  startsAt: string
  endsAt: string
  sessionUrl: string
  facilitatorNames: string[]
}

/** Plain-text announcement facilitators paste into the team's Teams channel once the preparation is ready. */
export function buildTeamsMessage({ topic, startsAt, endsAt, sessionUrl, facilitatorNames }: TeamsMessageInput): string {
  const day = formatDayHeading(startsAt)
  const when = `${day.charAt(0).toLocaleLowerCase("cs-CZ")}${day.slice(1)}, ${formatTimeRange(startsAt, endsAt)}`
  const lines = [
    "Ahoj,",
    "",
    `příprava na TS „${topic}“ (${when}) je připravená v Tappce:`,
    sessionUrl,
    "",
    "Mějte se fajn",
  ]
  if (facilitatorNames.length > 0) lines.push(facilitatorNames.join(", "))
  return lines.join("\n")
}
