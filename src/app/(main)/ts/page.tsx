import { redirect } from "next/navigation"

import { TS_ROUTES } from "@/lib/training-sessions/constants"

export default function TsIndexPage() {
  redirect(TS_ROUTES.overview)
}
