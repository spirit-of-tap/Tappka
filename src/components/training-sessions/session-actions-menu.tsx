"use client"

import { MoreVertical } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { TS_ROUTES } from "@/lib/training-sessions/constants"

type ConfirmKind = "cancel" | "delete"
type ActionKind = ConfirmKind | "restore"

const CONFIRM_COPY: Record<ConfirmKind, { title: string; description: string; action: string }> = {
  cancel: { title: "Zrušit TS?", description: "TS zůstane v historii označené jako zrušené.", action: "Zrušit TS" },
  delete: {
    title: "Smazat TS?",
    description: "Použij jen pro TS vytvořené omylem. Zmizí ze všech přehledů.",
    action: "Smazat",
  },
}

const SUCCESS_TOASTS: Record<ActionKind, string> = {
  cancel: "TS zrušeno",
  restore: "TS obnoveno",
  delete: "TS smazáno",
}

const GENERIC_ERROR_MESSAGE = "Akci se nepodařilo dokončit"

interface SessionActionsMenuProps {
  sessionId: string
  cancelled: boolean
}

export function SessionActionsMenu({ sessionId, cancelled }: SessionActionsMenuProps) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const [pending, setPending] = useState(false)

  async function run(kind: ActionKind) {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}`, {
        method: kind === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: kind === "delete" ? undefined : JSON.stringify({ kind }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? GENERIC_ERROR_MESSAGE)
        return
      }
      toast.success(SUCCESS_TOASTS[kind])
      if (kind === "delete") router.push(TS_ROUTES.overview)
      router.refresh()
    } catch {
      toast.error(GENERIC_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Další akce" disabled={pending}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={TS_ROUTES.edit(sessionId)}>Upravit</Link>
          </DropdownMenuItem>
          {cancelled ? (
            <DropdownMenuItem onSelect={() => void run("restore")}>Obnovit</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")}>Zrušit TS</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
            Smazat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirm && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{CONFIRM_COPY[confirm].title}</AlertDialogTitle>
              <AlertDialogDescription>{CONFIRM_COPY[confirm].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zpět</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run(confirm)}>{CONFIRM_COPY[confirm].action}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  )
}
