"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"

interface TeamMemberAdminActionsProps {
  profileId: string
  profileName: string | null
  mode: "remove" | "restore"
}

const COPY = {
  remove: {
    button: "Odebrat z týmu",
    title: "Odebrat z týmu?",
    confirm: "Odebrat z týmu",
    success: "Člen:ka odebrán:a z týmu",
    failure: "Nepodařilo se odebrat z týmu",
  },
  restore: {
    button: "Vrátit do týmu",
    title: "Vrátit do týmu?",
    confirm: "Vrátit do týmu",
    success: "Člen:ka vrácen:a do týmu",
    failure: "Nepodařilo se vrátit do týmu",
  },
} as const

export function TeamMemberAdminActions({
  profileId,
  profileName,
  mode,
}: TeamMemberAdminActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const copy = COPY[mode]

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          action: mode,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? copy.failure)
      }
      toast.success(copy.success)
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant={mode === "remove" ? "ghost" : "outline"}
        size="sm"
        className={
          mode === "remove"
            ? "h-7 text-xs text-destructive hover:text-destructive"
            : "h-7 text-xs"
        }
        onClick={() => setOpen(true)}
        aria-label={`${copy.button}: ${profileName ?? "profil"}`}
      >
        {copy.button}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "remove" ? (
              <>
                Opravdu chceš odebrat <strong>{profileName ?? "tuto osobu"}</strong> z
                týmu? Profil zůstane v portálu a dohledatelný:á v historii, ale přestane
                se počítat mezi aktivní členy:ky (např. v Rocket Modelu).
              </>
            ) : (
              <>
                Opravdu chceš vrátit <strong>{profileName ?? "tuto osobu"}</strong> zpět
                do původního týmu?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={saving}
            className={mode === "remove" ? "bg-destructive hover:bg-destructive/90" : undefined}
          >
            {saving && <Spinner className="mr-2 size-4" />}
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
