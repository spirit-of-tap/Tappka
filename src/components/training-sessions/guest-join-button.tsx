"use client"

import { Plus, UserCheck, X } from "lucide-react"
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
  /** "status": while joined, a "you're going" pill that turns into leave on hover/focus. */
  variant?: "default" | "badge" | "icon" | "status"
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

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
    // Touch has no hover preview of "Odhlásit se", so a tap on the status pill asks first.
    else if (joined && variant === "status") setLeaveConfirmOpen(true)
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
  } else if (variant === "status" && joined) {
    trigger = (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={onClick}
        aria-label="Jdeš jako cross – odhlásit se"
        className={cn(
          "group/leave grid rounded-full bg-success/15 font-semibold text-success-strong",
          "hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive",
          className,
        )}
      >
        {/* Both labels share one grid cell so the pill keeps its width when they swap. */}
        <span className="inline-flex items-center gap-1.5 [grid-area:1/1] group-hover/leave:invisible group-focus-visible/leave:invisible">
          {pending ? <Spinner className="size-3.5" /> : <UserCheck className="size-4 shrink-0" aria-hidden />}
          Jdeš jako cross
        </span>
        <span className="invisible inline-flex items-center justify-center gap-1.5 [grid-area:1/1] group-hover/leave:visible group-focus-visible/leave:visible">
          <X className="size-4 shrink-0" aria-hidden />
          Odhlásit se
        </span>
      </Button>
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
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odhlásit se z TS?</AlertDialogTitle>
            <AlertDialogDescription>Uvolníš místo pro někoho dalšího. Přihlásit se můžeš znovu, dokud bude volno.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zpět</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submit()}>Odhlásit se</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
