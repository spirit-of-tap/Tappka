"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    menuItem: "Odebrat z týmu",
    title: "Odebrat z týmu?",
    confirm: "Odebrat z týmu",
    success: "Člen:ka odebrán:a z týmu",
    failure: "Nepodařilo se odebrat z týmu",
  },
  restore: {
    menuItem: "Vrátit do týmu",
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const copy = COPY[mode]
  const Icon = mode === "remove" ? UserMinus : UserPlus

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
      setConfirmOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 text-muted-foreground/60 hover:text-foreground"
            aria-label={`Možnosti pro ${profileName ?? "profil"}`}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant={mode === "remove" ? "destructive" : "default"}
            onSelect={() => setConfirmOpen(true)}
          >
            <Icon />
            {copy.menuItem}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
    </>
  )
}
