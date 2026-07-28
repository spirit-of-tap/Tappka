"use client"

import { useState } from "react"
import Link from "next/link"
import { GraduationCap, Trash2 } from "lucide-react"
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
import type { TeamSemesterReflectionSummary } from "@/lib/tymova-reflexe/semester-types"

function semesterLabel(semesterMonth: string): string {
  const [year, month] = semesterMonth.split("-")
  return month === "01" ? `Zimní semestr ${year}` : `Letní semestr ${year}`
}

interface SemesterReflectionCardProps {
  reflection: TeamSemesterReflectionSummary
  onDeleted: (id: string) => void
}

export function SemesterReflectionCard({ reflection, onDeleted }: SemesterReflectionCardProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("team_semester_reflections")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", reflection.id)

      if (error) throw error
      toast.success("Semestrální reflexe odstraněna")
      onDeleted(reflection.id)
    } catch {
      toast.error("Nepodařilo se odstranit reflexi")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="relative p-3 sm:p-4 space-y-3 border-chart-5/30 hover:bg-chart-5/5 transition-colors">
      <Link
        href={`/tymova-reflexe/semestralni/${reflection.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Otevřít ${semesterLabel(reflection.semester_month)}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="size-4 shrink-0 text-chart-5" />
          <span className="font-semibold text-sm">{semesterLabel(reflection.semester_month)}</span>
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
                <AlertDialogTitle>Odstranit semestrální reflexi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce reflexi za {semesterLabel(reflection.semester_month)} odstraní včetně
                  všech vyplněných témat.
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

      <div className="relative z-10 flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground pointer-events-none">
        <span>
          {reflection.filledTopicsCount}/{reflection.totalTopicsCount} témat vyplněno
        </span>
        {reflection.created_by && (
          <span className="truncate">Vytvořil/a: {reflection.created_by.name}</span>
        )}
      </div>
    </Card>
  )
}
