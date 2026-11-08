import type { ReactNode } from "react"

import { PlaybookSidebar } from "@/components/playbook/playbook-sidebar"

export default function PlaybookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-64">
        <PlaybookSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
