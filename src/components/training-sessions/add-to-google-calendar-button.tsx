import { CalendarPlus } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AddToGoogleCalendarButtonProps {
  href: string
}

/** Opens Google Calendar's prefilled create-event screen for a joined session. */
export function AddToGoogleCalendarButton({ href }: AddToGoogleCalendarButtonProps) {
  return (
    <Button asChild variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <CalendarPlus aria-hidden />
        Přidat do Google kalendáře
      </a>
    </Button>
  )
}
