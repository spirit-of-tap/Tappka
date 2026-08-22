"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Thumb-reachable floating action button for mobile create actions.
 * Sits just above MobileBottomNav (fixed h-16 + safe-area, z-50) with a small
 * gap; pair it with a `<div aria-hidden className="h-20 sm:hidden" />` spacer
 * at the end of the page so the last row stays tappable above it.
 *
 * Desktop counterpart stays the header/inline button (`hidden sm:inline-flex`)
 * — one action, two triggers, matching the schůzky reference implementation.
 */
export function MobileFab({ label, href }: { label: string; href?: string }) {
  if (href) {
    return (
      <Button
        asChild
        size="icon"
        aria-label={label}
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg sm:hidden"
      >
        <Link href={href}>
          <Plus className="size-6" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      size="icon"
      aria-label={label}
      className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg sm:hidden"
    >
      <Plus className="size-6" />
    </Button>
  )
}

/** Reserved space under the last content row so the FAB covers nothing. */
export function MobileFabSpacer() {
  return <div aria-hidden className="h-20 sm:hidden" />
}
