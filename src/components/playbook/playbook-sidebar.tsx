"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { PlaybookSearch } from "@/components/playbook/playbook-search"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PLAYBOOK_CHAPTERS } from "@/lib/playbook/content"
import { cn } from "@/lib/utils"

export function PlaybookSidebar() {
  const pathname = usePathname()

  return (
    <div className="space-y-3">
      <PlaybookSearch />
      {/* Collapsed behind a toggle on mobile; the lg:block override keeps the
          content visible on desktop regardless of the collapsible state. */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-ring lg:hidden">
          Kapitoly
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform duration-150 motion-reduce:transition-none group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="lg:block">
          <nav aria-label="Kapitoly">
            <ul className="space-y-0.5">
              {PLAYBOOK_CHAPTERS.map((chapter) => {
                const href = `/playbook/${chapter.slug}`
                const isActive = pathname === href
                return (
                  <li key={chapter.slug}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-ring",
                        isActive
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {chapter.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
