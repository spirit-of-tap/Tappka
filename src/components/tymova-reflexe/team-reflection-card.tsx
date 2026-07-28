"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2, Calendar, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function PreviewField({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-muted-foreground line-clamp-2">{children}</p>
    </div>
  )
}

interface TeamReflectionCardProps {
  reflection: TeamReflectionWithCreator
  onDeleted: (id: string) => void
}

export function TeamReflectionCard({
  reflection,
  onDeleted,
}: TeamReflectionCardProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("team_reflections")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", reflection.id)

      if (error) throw error
      toast.success("Reflexe odstraněna")
      onDeleted(reflection.id)
    } catch {
      toast.error("Nepodařilo se odstranit reflexi")
    } finally {
      setDeleting(false)
    }
  }

  const hasContent =
    reflection.what_went_well ||
    reflection.what_didnt_go_well ||
    reflection.what_we_do_differently ||
    reflection.planned_action_steps

  return (
    <Card className="relative p-3 sm:p-4 space-y-3 hover:bg-accent/30 transition-colors">
      <Link
        href={`/tymova-reflexe/${reflection.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Otevřít reflexi za ${monthLabel(reflection.month)}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-sm">{monthLabel(reflection.month)}</span>
        </div>

        <div className="pointer-events-auto shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Smazat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odstranit reflexi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce reflexi za {monthLabel(reflection.month)} odstraní.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                >
                  {deleting ? "Odstraňuji..." : "Odstranit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {hasContent ? (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 pointer-events-none">
          {reflection.what_went_well && (
            <PreviewField label="Co se povedlo">{reflection.what_went_well}</PreviewField>
          )}
          {reflection.what_didnt_go_well && (
            <PreviewField label="Co se nepovedlo">{reflection.what_didnt_go_well}</PreviewField>
          )}
        </div>
      ) : (
        <p className="relative z-10 border-t pt-3 text-sm text-muted-foreground/70 italic pointer-events-none">
          Zatím nevyplněno — klikněte pro úpravu
        </p>
      )}

      <div className="relative z-10 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground pointer-events-none">
        <span className="truncate">
          {reflection.created_by && `Vytvořil/a: ${reflection.created_by.name}`}
        </span>
        {reflection.responsible_person && (
          <span className="flex items-center gap-1 shrink-0">
            <UserRound className="size-3" />
            {reflection.responsible_person}
          </span>
        )}
      </div>
    </Card>
  )
}
