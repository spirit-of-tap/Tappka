"use client"

import { useMemo, useState } from "react"
import { ExternalLink, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { toast } from "sonner"
import { PersonalityTestForm } from "./personality-test-form"
import { formatFileSize, formatTestDate } from "@/lib/personality-tests/format"
import { getTestTypeLabel } from "@/lib/personality-tests/types"
import type { PersonalityTest } from "@/lib/personality-tests/types"

interface PersonalityTestTimelineProps {
  initialTests: PersonalityTest[]
  profileId: string
  isOwnProfile: boolean
}

export function PersonalityTestTimeline({ initialTests, profileId, isOwnProfile }: PersonalityTestTimelineProps) {
  const [items, setItems] = useState(initialTests)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalityTest | null>(null)
  const [deleting, setDeleting] = useState<PersonalityTest | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.tested_on.localeCompare(a.tested_on)),
    [items],
  )

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
      {isOwnProfile && (
        <div className="flex items-center justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="size-4" />
                Nahrát test
              </Button>
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
        </div>
      )}

      {sorted.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <FileText className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {isOwnProfile ? "Zatím nemáš nahraný žádný osobnostní test" : "Zatím žádné osobnostní testy"}
            </EmptyTitle>
            <EmptyDescription>
              {isOwnProfile
                ? "Nahraj výsledky svého osobnostního testu jako soubor PDF nebo obrázek. Timeline ukáže, jak se v průběhu studia vyvíjíš."
                : "Tato osoba zatím nenahrála žádné osobnostní testy."}
            </EmptyDescription>
          </EmptyHeader>
          {isOwnProfile && (
            <EmptyContent>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Upload className="size-4" />
                Nahrát test
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ol className="space-y-6">
          {sorted.map((test, index) => (
            <li key={test.id} className="relative pl-6 sm:pl-8">
              {index < sorted.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-0 top-5 bottom-[-32px] w-px bg-border"
                />
              )}
              <span
                aria-hidden
                className="absolute left-0 top-2 size-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"
              />
              <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{getTestTypeLabel(test)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTestDate(test.tested_on)} · {test.file_name} · {formatFileSize(test.file_size)}
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
                  {isOwnProfile && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Upravit test"
                        onClick={() => setEditing(test)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Upravit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        aria-label="Smazat test"
                        onClick={() => setDeleting(test)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Smazat</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

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
                  odebereš ze svého profilu. Nahraný soubor bude smazán.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null && <Loader2 className="size-4 animate-spin" />}
              Odstranit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
