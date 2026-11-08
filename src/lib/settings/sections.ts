/**
 * Sections of the general Nastavení hub (`/settings`). Each section is its own
 * subpage; visibility mirrors the access rules of the page it links to.
 */
import { canAccessFeature, type AccessProfile } from "@/lib/feature-access"

export const SETTINGS_ROUTES = {
  root: "/settings",
  notifikace: "/settings/notifikace",
  cas: "/settings/cas",
  mistnosti: "/settings/mistnosti",
} as const

export const SETTINGS_SECTION_IDS = ["notifikace", "cas", "mistnosti"] as const
export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number]

/** Same roles the room/TS schedule page has always required. */
const ROOM_SETTINGS_ROLES: readonly string[] = ["coach", "admin"]

export interface SettingsSection {
  id: SettingsSectionId
  title: string
  description: string
  href: string
}

const SECTIONS: Record<SettingsSectionId, SettingsSection & { visible: (profile: AccessProfile) => boolean }> = {
  notifikace: {
    id: "notifikace",
    title: "Notifikace",
    description: "E-maily a souhlas s měřením",
    href: SETTINGS_ROUTES.notifikace,
    visible: () => true,
  },
  cas: {
    id: "cas",
    title: "Tagy v Čase",
    description: "Které tagy se ti nabízejí",
    href: SETTINGS_ROUTES.cas,
    visible: (profile) => canAccessFeature(profile, "timeTracking"),
  },
  mistnosti: {
    id: "mistnosti",
    title: "Místnosti",
    description: "Rozvrh TS a volna",
    href: SETTINGS_ROUTES.mistnosti,
    visible: (profile) => ROOM_SETTINGS_ROLES.includes(profile.role),
  },
}

export function visibleSettingsSections(profile: AccessProfile): SettingsSection[] {
  return SETTINGS_SECTION_IDS.flatMap((id) => {
    const { visible, ...section } = SECTIONS[id]
    return visible(profile) ? [section] : []
  })
}

export function canSeeSettingsSection(profile: AccessProfile, id: SettingsSectionId): boolean {
  return SECTIONS[id].visible(profile)
}

/** Which section a pathname belongs to; `null` on the hub itself. */
export function activeSettingsSection(pathname: string): SettingsSectionId | null {
  return SETTINGS_SECTION_IDS.find((id) => pathname === SECTIONS[id].href || pathname.startsWith(`${SECTIONS[id].href}/`)) ?? null
}
