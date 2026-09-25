import type { ReactNode } from "react"

import { CasTabBar } from "@/components/time-tracking/cas-tab-bar"

/** Tab bar „Moje" / „Tým" for every /cas/* route. Access is gated by each page. */
export default function CasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CasTabBar />
      {children}
    </>
  )
}
