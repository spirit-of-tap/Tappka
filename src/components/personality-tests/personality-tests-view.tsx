"use client"

import { useMemo, useState } from "react"
import { ExternalLink, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { HelpDialog } from "@/components/help-dialog"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { SemesterSeparator } from "@/components/ui/semester-separator"
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
import { InfoCard } from "./info-card"
import { PersonalityTestForm } from "./personality-test-form"
import { formatFileSize, formatTestDate } from "@/lib/personality-tests/format"
import { getTestTypeLabel } from "@/lib/personality-tests/types"
import { getSemesterInfo, type SemesterInfo } from "@/lib/timeline/semester-utils"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import type { PersonalityTest } from "@/lib/personality-tests/types"

interface PersonalityTestsViewProps {
  tests: PersonalityTest[]
  profileId: string
  onboardingYear?: number | null
}

interface SemesterGroup {
  key: string
  info: SemesterInfo | null
  items: PersonalityTest[]
}

export function PersonalityTestsView({ tests, profileId, onboardingYear }: PersonalityTestsViewProps) {
  const [items, setItems] = useState(tests)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalityTest | null>(null)
  const [deleting, setDeleting] = useState<PersonalityTest | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.tested_on.localeCompare(a.tested_on)),
    [items],
  )

  const semesterGroups = useMemo(() => {
    const groups: SemesterGroup[] = []
    let currentKey: string | null = null
    let currentGroup: SemesterGroup | null = null

    for (const test of sorted) {
      const info = getSemesterInfo(test.tested_on, onboardingYear)
      const key = info?.key ?? "undated"
      if (key !== currentKey || !currentGroup) {
        currentKey = key
        currentGroup = {
          key,
          info,
          items: [test],
        }
        groups.push(currentGroup)
      } else {
        currentGroup.items.push(test)
      }
    }

    return groups
  }, [sorted, onboardingYear])

  function handleCreated(test: PersonalityTest) {
    setItems((prev) => [...prev, test])
    setCreateOpen(false)
  }

  function handleUpdated(test: PersonalityTest) {
    setItems((prev) => prev.map((t) => (t.id === test.id ? test : t)))
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const res = await fetch(`/api/personality-tests/${deleting.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Nepodařilo se odstranit test")
      setItems((prev) => prev.filter((t) => t.id !== deleting.id))
      toast.success("Test odstraněn")
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se odstranit test")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Osobnostní testy"
          description="Výsledky osobnostních testů a jejich vývoj v čase"
          count={{
            value: items.length,
            label: pluralizeCz(items.length, ["test", "testy", "testů"]),
          }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co jsou osobnostní testy?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Upload className="size-4" />
                  Nahrát test
                </Button>
              </DialogTrigger>
            </div>
          }
        />

        {sorted.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <FileText className="size-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Zatím nemáš nahraný žádný osobnostní test</EmptyTitle>
              <EmptyDescription>
                Nahraj výsledky svého osobnostního testu jako soubor PDF nebo obrázek. Časová osa ukáže, jak se v průběhu studia vyvíjíš.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Upload className="size-4" />
                Nahrát test
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-6">
            {semesterGroups.map((group, groupIndex) => (
              <section key={group.key} className="space-y-3" aria-label={group.info?.label ?? "Bez semestru"}>
                {group.info && (
                  <SemesterSeparator
                    label={group.info.label}
                    semester={group.info.semester}
                    className={groupIndex === 0 ? "mt-2 mb-3" : "mt-6 mb-3"}
                  />
                )}
                <ol className="space-y-3">
                  {group.items.map((test) => (
                    <li key={test.id}>
                      <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:bg-accent/30">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{getTestTypeLabel(test)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatTestDate(test.tested_on)} · {formatFileSize(test.file_size)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={`/api/personality-tests/${test.id}/open`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                              <span className="sr-only sm:not-sr-only sm:inline">Otevřít</span>
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            aria-label="Upravit test"
                            onClick={() => setEditing(test)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground/60 hover:text-destructive"
                            aria-label="Smazat test"
                            onClick={() => setDeleting(test)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        <DialogTrigger asChild>
          <MobileFab label="Nahrát test" />
        </DialogTrigger>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nový osobnostní test</DialogTitle>
          </DialogHeader>
          <PersonalityTestForm
            profileId={profileId}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upravit test</DialogTitle>
          </DialogHeader>
          {editing && (
            <PersonalityTestForm
              profileId={profileId}
              initial={editing}
              onSuccess={handleUpdated}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit test?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Test <strong>{getTestTypeLabel(deleting)}</strong> ({formatTestDate(deleting.tested_on)}){" "}
                  odebereš ze svého účtu. Nahraný soubor bude smazán.
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
              Odstranit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileFabSpacer />
    </div>
  )
}
