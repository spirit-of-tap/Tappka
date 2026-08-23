"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Wrench, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { PageHeader } from "@/components/ui/page-header"
import { HelpDialog } from "@/components/help-dialog"
import { InfoCard } from "./info-card"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { TOOL_TYPES, getToolTypeInfo } from "@/lib/nastroje-techniky/constants"
import type { ToolType } from "@/lib/nastroje-techniky/constants"
import type { ToolTechnique } from "@/lib/nastroje-techniky/types"
import { ToolTechniqueForm } from "./tool-technique-form"

type ActiveFilter = "all" | ToolType

interface ToolsTechniquesViewProps {
  items: ToolTechnique[]
  profileId: string
}

export function ToolsTechniquesView({ items: initialItems, profileId }: ToolsTechniquesViewProps) {
  const [items, setItems] = useState(initialItems)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all")
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [defaultCreateType, setDefaultCreateType] = useState<ToolType | undefined>(undefined)
  const [editing, setEditing] = useState<ToolTechnique | null>(null)
  const [deleting, setDeleting] = useState<ToolTechnique | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!searching) return items
    return items.filter((item) => {
      const haystack = [item.name, item.reflection].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [items, searching, normalizedQuery])

  const countsByType = useMemo(() => {
    const counts: Record<ToolType, number> = {
      model: 0,
      technique: 0,
      tool: 0,
    }
    for (const item of filteredItems) {
      if (item.tool_type in counts) {
        counts[item.tool_type]++
      }
    }
    return counts
  }, [filteredItems])

  function handleCreated(item: ToolTechnique) {
    setItems((prev) => [...prev, item])
    setCreateOpen(false)
    setDefaultCreateType(undefined)
  }

  function handleUpdated(item: ToolTechnique) {
    setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)))
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("tools_techniques")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", deleting.id)

      if (error) throw error
      toast.success("Záznam odstraněn")
      setItems((prev) => prev.filter((row) => row.id !== deleting.id))
      setDeleting(null)
    } catch {
      toast.error("Nepodařilo se odstranit záznam")
    } finally {
      setDeletingId(null)
    }
  }

  function openCreateDialog(type?: ToolType) {
    setDefaultCreateType(type)
    setCreateOpen(true)
  }

  function toggleFilter(filter: ActiveFilter) {
    setActiveFilter((prev) => (prev === filter && filter !== "all" ? "all" : filter))
  }

  const hasAnyItems = items.length > 0
  const hasFilteredResults = filteredItems.length > 0

  // Determine which type sections to render
  const typesToRender = activeFilter === "all" ? TOOL_TYPES : TOOL_TYPES.filter((t) => t.value === activeFilter)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Shared create dialog & PageHeader */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setDefaultCreateType(undefined)
        }}
      >
        <PageHeader
          title="Nástroje a techniky"
          description="Katalog modelů, technik a nástrojů, které umíš používat pro efektivní práci"
          count={{
            value: items.length,
            label: pluralizeCz(items.length, ["záznam", "záznamy", "záznamů"]),
          }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co jsou nástroje a techniky?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex" onClick={() => openCreateDialog()}>
                  <Plus className="size-4" />
                  Přidat záznam
                </Button>
              </DialogTrigger>
            </div>
          }
        />
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nový záznam</DialogTitle>
          </DialogHeader>
          <ToolTechniqueForm
            profileId={profileId}
            defaultToolType={defaultCreateType}
            onSuccess={handleCreated}
            onCancel={() => {
              setCreateOpen(false)
              setDefaultCreateType(undefined)
            }}
          />
        </DialogContent>
        {/* Mobile FAB */}
        <DialogTrigger asChild>
          <MobileFab label="Přidat záznam" onClick={() => openCreateDialog()} />
        </DialogTrigger>
      </Dialog>

      {/* Search & Filter Badges */}
      {hasAnyItems && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat záznam podle názvu nebo reflexe…"
              className="pl-9 pr-8"
              aria-label="Hledat záznam"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Zrušit hledání"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Badges below search bar */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrovat podle oblasti">
            <Badge
              variant={activeFilter === "all" ? "default" : "outline"}
              className={cn(
                "cursor-pointer select-none text-xs py-1 px-3 transition-colors font-medium",
                activeFilter === "all"
                  ? "hover:bg-primary/90"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => toggleFilter("all")}
            >
              Vše ({filteredItems.length})
            </Badge>
            {TOOL_TYPES.map((type) => (
              <Badge
                key={type.value}
                variant={activeFilter === type.value ? "default" : "outline"}
                className={cn(
                  "cursor-pointer select-none text-xs py-1 px-3 transition-colors font-medium",
                  activeFilter === type.value
                    ? "hover:bg-primary/90"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => toggleFilter(type.value)}
              >
                {type.pluralLabel} ({countsByType[type.value]})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!hasAnyItems ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Wrench className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné záznamy</EmptyTitle>
            <EmptyDescription>
              Zatím nemáš žádné modely, techniky ani nástroje. Přidej první záznam, který ovládáš a
              pravidelně používáš.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => openCreateDialog()}>
              <Plus className="size-4" />
              Přidat záznam
            </Button>
          </EmptyContent>
        </Empty>
      ) : !hasFilteredResults ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Search className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nic jsme nenašli</EmptyTitle>
            <EmptyDescription>
              Pro „{query.trim()}“ nebyly nalezeny žádné záznamy.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              Zrušit hledání
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-8">
          {typesToRender.map((typeInfo) => {
            const sectionItems = filteredItems.filter((item) => item.tool_type === typeInfo.value)

            // When browsing "all", skip sections that have no items matching the query/filter
            if (activeFilter === "all" && sectionItems.length === 0) {
              return null
            }

            return (
              <section
                key={typeInfo.value}
                className="space-y-4"
                aria-labelledby={`heading-${typeInfo.value}`}
              >
                {/* Section Header */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2
                      id={`heading-${typeInfo.value}`}
                      className="font-heading text-lg font-semibold text-foreground"
                    >
                      {typeInfo.pluralLabel}
                    </h2>
                    <Badge variant="secondary" className="h-5 px-2 text-xs font-medium">
                      {sectionItems.length}
                    </Badge>
                    <div aria-hidden className="h-px min-w-4 flex-1 bg-border" />
                  </div>
                  <p className="text-xs text-muted-foreground">{typeInfo.description}</p>
                </div>

                {/* Cards Grid */}
                {sectionItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Zatím nemáš přidané žádné {typeInfo.pluralLabel.toLowerCase()}.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreateDialog(typeInfo.value)}
                    >
                      <Plus className="size-4" />
                      Přidat {typeInfo.label.toLowerCase()}
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sectionItems.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-border hover:shadow-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-heading text-base font-semibold text-foreground break-words">
                              {item.name}
                            </h3>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground"
                                aria-label={`Upravit ${item.name}`}
                                onClick={() => setEditing(item)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Odstranit ${item.name}`}
                                onClick={() => setDeleting(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {item.reflection}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Upravit záznam</DialogTitle>
          </DialogHeader>
          {editing && (
            <ToolTechniqueForm
              profileId={profileId}
              initial={editing}
              onSuccess={handleUpdated}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit záznam?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Záznam „{deleting.name}“ ({getToolTypeInfo(deleting.tool_type).label.toLowerCase()}) odebereš z katalogu.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null && <Loader2 className="size-4 animate-spin" />}
              {deletingId !== null ? "Odstraňuji..." : "Odstranit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileFabSpacer />
    </div>
  )
}
