"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Thumb-reachable floating action button for mobile create actions — extended
 * variant with a visible label, not just an icon.
 * Sits just above MobileBottomNav (fixed h-16 + safe-area, z-50) with a small
 * gap; pair it with `<MobileFabSpacer />` at the end of the page so the last
 * row stays tappable above it.
 *
 * Desktop counterpart stays the header/inline button (`hidden sm:inline-flex`)
 * — one action, two triggers, matching the schůzky reference implementation.
 */
const FAB_CLASSES =
  "fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 h-12 rounded-full px-4 shadow-lg sm:hidden"

export function MobileFab({ label, href }: { label: string; href?: string }) {
  if (href) {
    return (
      <Button asChild className={FAB_CLASSES}>
        <Link href={href}>
          <Plus className="size-5" />
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <Button className={FAB_CLASSES}>
      <Plus className="size-5" />
      {label}
    </Button>
  )
}

/** Reserved space under the last content row so the FAB covers nothing. */
export function MobileFabSpacer() {
  return <div aria-hidden className="h-20 sm:hidden" />
}
