"use client"

import { useState } from "react"
import { Pencil, Trash2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { TeamReflectionForm } from "./team-reflection-form"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </div>
  )
}

interface TeamReflectionCardProps {
  reflection: TeamReflectionWithCreator
  teamId: string
  profileId: string
  onUpdated: (reflection: TeamReflectionWithCreator) => void
  onDeleted: (id: string) => void
}

export function TeamReflectionCard({
  reflection,
  teamId,
  profileId,
  onUpdated,
  onDeleted,
}: TeamReflectionCardProps) {
  const [editOpen, setEditOpen] = useState(false)
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

  function handleUpdated(updated: TeamReflectionWithCreator) {
    setEditOpen(false)
    onUpdated(updated)
    toast.success("Reflexe aktualizována")
  }

  return (
    <Card className="p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-sm">{monthLabel(reflection.month)}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Upravit</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upravit reflexi</DialogTitle>
              </DialogHeader>
              <TeamReflectionForm
                teamId={teamId}
                profileId={profileId}
                initial={reflection}
                onSuccess={handleUpdated}
                onCancel={() => setEditOpen(false)}
              />
            </DialogContent>
          </Dialog>
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

      <div className="border-t pt-4 space-y-4">
        {reflection.what_went_well && (
          <Field label="Co se povedlo">{reflection.what_went_well}</Field>
        )}
        {reflection.what_didnt_go_well && (
          <Field label="Co se nepovedlo">{reflection.what_didnt_go_well}</Field>
        )}
        {reflection.what_we_do_differently && (
          <Field label="Co uděláme jinak">{reflection.what_we_do_differently}</Field>
        )}
        {reflection.planned_action_steps && (
          <Field label="Plánované akční kroky">{reflection.planned_action_steps}</Field>
        )}
        {reflection.responsible_person && (
          <Field label="Zodpovědná osoba">{reflection.responsible_person}</Field>
        )}
      </div>

      {reflection.created_by && (
        <div className="border-t pt-3 text-xs text-muted-foreground">
          Vytvořil/a: {reflection.created_by.name}
        </div>
      )}
    </Card>
  )
}
