import { SlidersHorizontal } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata = {
  title: "Nastavení",
  description: "Notifikace, tagy v Čase a další nastavení Tappky",
}

// On phones the layout shows only the section list here; this fills the desktop content pane.
export default function SettingsPage() {
  return (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal className="size-6" />
        </EmptyMedia>
        <EmptyTitle>Vyber, co chceš nastavit</EmptyTitle>
        <EmptyDescription>Sekce najdeš v seznamu vlevo.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
