import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageShellSize = "full" | "narrow" | "medium" | "wide"

const SIZE_CLASSES: Record<PageShellSize, string> = {
  full: "",
  narrow: "max-w-2xl",
  medium: "max-w-3xl",
  wide: "max-w-4xl",
}

interface PageShellProps {
  size?: PageShellSize
  className?: string
  children: ReactNode
}

export function PageShell({ size = "full", className, children }: PageShellProps) {
  return (
    // suppressHydrationWarning: browser extensions (ProtonPass, …) inject
    // attributes like `data-protonpass-form` into this container before
    // hydration. One level deep only — real mismatches inside are unaffected.
    <div
      suppressHydrationWarning
      className={cn(
        "container mx-auto space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </div>
  )
}
