"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { getToolTypeInfo } from "@/lib/nastroje-techniky/constants"
import { ToolTechniqueForm } from "./tool-technique-form"
import type { ToolTechnique } from "@/lib/nastroje-techniky/types"

interface ToolsTechniquesTableProps {
  items: ToolTechnique[]
  profileId: string
}

export function ToolsTechniquesTable({ items, profileId }: ToolsTechniquesTableProps) {
  const [rows, setRows] = useState(items)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ToolTechnique | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleCreated(item: ToolTechnique) {
    setRows((prev) => [...prev, item])
    setCreateOpen(false)
  }

  function handleUpdated(item: ToolTechnique) {
    setRows((prev) => prev.map((row) => (row.id === item.id ? item : row)))
    setEditing(null)
  }

  async function handleDelete(item: ToolTechnique) {
    setDeletingId(item.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("tools_techniques")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", item.id)

      if (error) throw error
      toast.success("Záznam odstraněn")
      setRows((prev) => prev.filter((row) => row.id !== item.id))
    } catch {
      toast.error("Nepodařilo se odstranit záznam")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="hidden sm:inline-flex">
              <Plus className="size-4" />
              Přidat záznam
            </Button>
          </DialogTrigger>
          {/* Mobile FAB — second trigger of the shared dialog. */}
          <DialogTrigger asChild>
            <MobileFab label="Přidat záznam" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Nový záznam</DialogTitle>
            </DialogHeader>
            <ToolTechniqueForm
              profileId={profileId}
              onSuccess={handleCreated}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
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
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat záznam
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Oblast</TableHead>
                <TableHead className="w-56">Název</TableHead>
                <TableHead>Vlastní reflexe</TableHead>
                <TableHead className="w-20 text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const typeInfo = getToolTypeInfo(row.tool_type)
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="outline" title={typeInfo.description}>
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="whitespace-normal">{row.reflection}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={editing?.id === row.id}
                          onOpenChange={(open) => { if (!open) setEditing(null) }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Upravit ${row.name}`}
                              onClick={() => setEditing(row)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </DialogTrigger>
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive"
                              aria-label={`Odstranit ${row.name}`}
                              disabled={deletingId === row.id}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Odstranit záznam?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Záznam „{row.name}“ ({typeInfo.label.toLowerCase()}) odebereš z katalogu.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Zrušit</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void handleDelete(row)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletingId === row.id}
                              >
                                {deletingId === row.id ? "Odstraňuji..." : "Odstranit"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <MobileFabSpacer />
    </div>
  )
}
