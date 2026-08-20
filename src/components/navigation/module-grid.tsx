import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { NavModule } from "@/lib/navigation"

interface ModuleGridProps {
  modules: NavModule[]
  /** Enables the own-profile link for Osobnostní testy. */
  profileId?: string
}

export function ModuleGrid({ modules, profileId }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {modules.map((m) => {
        const href =
          m.title === "Osobnostní testy" && profileId
            ? `/komunita/profil/${profileId}?tab=osobnostni-testy`
            : m.url

        return (
          <Link
            key={m.title}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <m.icon className="size-5" aria-hidden />
              </div>
              {m.betaOnly && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Beta
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold leading-tight">{m.title}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}