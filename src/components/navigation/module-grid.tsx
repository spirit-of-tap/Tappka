import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { NavModule } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface ModuleGridProps {
  modules: NavModule[]
  /** Required to render modules with ownProfileTab (links to the signed-in user's profile). */
  profileId?: string
}

function moduleHref(module: NavModule, profileId?: string): string {
  return module.ownProfileTab && profileId
    ? `/komunita/profil/${profileId}?tab=${module.ownProfileTab}`
    : module.url
}

function ModuleCard({ module, profileId }: { module: NavModule; profileId?: string }) {
  return (
    <Link
      href={moduleHref(module, profileId)}
      className={cn(
        "group rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus-ring",
        module.featured ? "col-span-2 flex items-center gap-3" : "flex flex-col gap-3",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <module.icon className="size-5" aria-hidden />
      </div>
      <div className={cn("space-y-1", module.featured && "min-w-0 flex-1")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold leading-tight">{module.title}</h2>
          {module.feature && (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
              Beta
            </Badge>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{module.description}</p>
      </div>
    </Link>
  )
}

export function ModuleGrid({ modules, profileId }: ModuleGridProps) {
  const renderable = modules.filter((m) => !m.ownProfileTab || profileId)
  const internalModules = renderable.filter((m) => !m.external)
  const externalModules = renderable.filter((m) => m.external)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {internalModules.map((m) => (
          <ModuleCard key={m.title} module={m} profileId={profileId} />
        ))}
      </div>

      {externalModules.length > 0 && (
        <section aria-labelledby="external-modules-heading" className="space-y-3">
          <h2
            id="external-modules-heading"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Externí odkazy
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-muted/20">
            {externalModules.map((m) => (
              <li key={m.title}>
                <Link
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50 focus-ring"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <m.icon className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold leading-tight">{m.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
                  </div>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(otevře se v nové záložce)</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
