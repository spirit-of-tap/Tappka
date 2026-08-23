import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

interface PageBackProps {
  href: string
  label: string
  /** Extra classes for special placements (e.g. overlays on hero banners). */
  className?: string
}

/**
 * Standardized back navigation for child pages: chevron + visible label,
 * ≥44px tap height for a native-app feel on touch devices.
 */
export function PageBack({ href, label, className }: PageBackProps) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-ring -ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  )
}
