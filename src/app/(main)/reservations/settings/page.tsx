import { permanentRedirect } from "next/navigation"

import { SETTINGS_ROUTES } from "@/lib/settings/sections"

/** Room settings moved into the general Nastavení hub; keep old links and bookmarks working. */
export default function ReservationSettingsRedirect() {
  permanentRedirect(SETTINGS_ROUTES.mistnosti)
}
