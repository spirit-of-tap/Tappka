"use client"

import { Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { cn } from "@/lib/utils"

const GENERIC_ERROR_MESSAGE = "Akci se nepodařilo dokončit"

export interface GuestJoinButtonProps {
  sessionId: string
  joined: boolean
  conflictText: string | null
  variant?: "default" | "badge" | "icon"
  className?: string
}

export function GuestJoinButton({
  sessionId,
  joined,
  conflictText,
  variant = "default",
  className,
}: GuestJoinButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function submit() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/guests`, { method: joined ? "DELETE" : "POST" })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? GENERIC_ERROR_MESSAGE)
        return
      }
      toast.success(joined ? "Odhlášeno z TS" : "Přihlášeno na TS")
    } catch {
      toast.error(GENERIC_ERROR_MESSAGE)
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  function onClick() {
    if (!joined && conflictText) setConfirmOpen(true)
    else void submit()
  }

  let trigger: React.ReactNode

  if (variant === "icon") {
    trigger = (
      <button
        type="button"
        title="Odhlásit se z crossu"
        aria-label="Odhlásit se"
        disabled={pending}
        onClick={onClick}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer focus-ring",
          className,
        )}
      >
        {pending ? <Spinner className="size-3" /> : <X className="size-3.5 shrink-0" aria-hidden />}
      </button>
    )
  } else if (variant === "badge") {
    trigger = (
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-border/80 bg-muted/40 hover:bg-muted/80 pl-1 pr-3 text-xs font-medium text-foreground transition-colors cursor-pointer focus-ring disabled:opacity-50 select-none",
          joined && "border-destructive/40 text-destructive hover:bg-destructive/10",
          className,
        )}
      >
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-2xs",
            joined && "bg-destructive/10 text-destructive",
          )}
        >
          {pending ? (
            <Spinner className="size-3" />
          ) : joined ? (
            <X className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Plus className="size-3.5 shrink-0" aria-hidden />
          )}
        </div>
        <span>{joined ? "Odhlásit se" : "Přihlásit se"}</span>
      </button>
    )
  } else {
    trigger = (
      <Button size="sm" variant={joined ? "outline" : "default"} disabled={pending} onClick={onClick} className={className}>
        {joined ? "Odhlásit se" : "Přihlásit se"}
      </Button>
    )
  }

  return (
    <>
      {trigger}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>TS se kryje s tvým programem</AlertDialogTitle>
            <AlertDialogDescription>{conflictText} Chceš se přesto přihlásit?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zpět</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submit()}>Přihlásit se</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
