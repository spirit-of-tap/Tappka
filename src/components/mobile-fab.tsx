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
 *
 * Spread of extra props matters: Radix `DialogTrigger asChild` attaches
 * onClick/ref to its child element — when that child is this component, they
 * must reach the underlying Button or clicks die silently.
 */
const FAB_CLASSES =
  "fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 h-12 rounded-full px-4 shadow-lg sm:hidden"

type MobileFabProps = {
  label: string
  /** When set the FAB navigates instead of acting as a dialog trigger. */
  href?: string
} & React.ComponentProps<typeof Button>

export function MobileFab({ label, href, ...props }: MobileFabProps) {
  const content = (
    <>
      <Plus className="size-5" />
      {label}
    </>
  )

  if (href) {
    return (
      <Button asChild {...props} className={FAB_CLASSES}>
        <Link href={href}>{content}</Link>
      </Button>
    )
  }

  return (
    <Button {...props} className={FAB_CLASSES}>
      {content}
    </Button>
  )
}

/** Reserved space under the last content row so the FAB covers nothing. */
export function MobileFabSpacer() {
  return <div aria-hidden className="h-20 sm:hidden" />
}
