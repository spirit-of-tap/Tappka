import { format } from "date-fns"
import { cs } from "date-fns/locale"

/** Short Czech date-time for "who checked what when" ("10. 9. 2026 8:05"). */
export function formatRocketDateTime(date: Date): string {
  return format(date, "d. M. yyyy H:mm", { locale: cs })
}
