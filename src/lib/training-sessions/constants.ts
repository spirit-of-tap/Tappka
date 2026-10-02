export const TS_LIMITS = {
  topicMax: 200,
  descriptionMax: 2_000,
  locationNoteMax: 200,
  guestCapacityMax: 50,
  facilitatorsMax: 20,
  attendeesMax: 100,
  maxDurationMs: 12 * 60 * 60 * 1000,
  slotSuggestions: 6,
  slotHorizonDays: 120,
} as const

export const TS_REALTIME_TOPIC = "community:training_sessions:feed"

export const TS_REALTIME_EVENTS = {
  guestJoined: "guest_joined",
  guestLeft: "guest_left",
  sessionUpdated: "session_updated",
} as const

export const TS_GUEST_ERROR_CODES = [
  "not_found",
  "cancelled",
  "already_started",
  "own_team",
  "capacity_full",
] as const

export type TsGuestErrorCode = (typeof TS_GUEST_ERROR_CODES)[number]

export const TS_GUEST_ERROR_MESSAGES: Record<TsGuestErrorCode, string> = {
  not_found: "TS nebylo nalezeno",
  cancelled: "TS bylo zrušeno",
  already_started: "TS už začalo, přihlášení je uzavřené",
  own_team: "Na TS svého týmu se přihlásit nelze",
  capacity_full: "Volná místa už jsou obsazená",
}

export const TS_ROUTES = {
  root: "/ts",
  overview: "/ts/prehled",
  discover: "/ts/objevovat",
  create: "/ts/nova",
  detail: (id: string) => `/ts/${id}`,
  edit: (id: string) => `/ts/${id}/upravit`,
} as const

export const TS_DISCOVER_FILTERS = ["nadchazejici", "volna-mista", "muj-tym", "prihlasene", "probehle"] as const
export type TsDiscoverFilter = (typeof TS_DISCOVER_FILTERS)[number]

export const TS_DISCOVER_FILTER_LABELS: Record<TsDiscoverFilter, string> = {
  nadchazejici: "Nadcházející",
  "volna-mista": "Volná místa",
  "muj-tym": "Můj tým",
  prihlasene: "Přihlášené",
  probehle: "Proběhlé",
}

export const TS_DETAIL_TABS = ["priprava", "dochazka", "reflexe"] as const
export type TsDetailTab = (typeof TS_DETAIL_TABS)[number]

export const PRAGUE_TIME_ZONE = "Europe/Prague"
