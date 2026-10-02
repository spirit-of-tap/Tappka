"use client"

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

const GENERIC_ERROR_MESSAGE = "Akci se nepodařilo dokončit"

interface GuestJoinButtonProps {
  sessionId: string
  joined: boolean
  conflictText: string | null
}

export function GuestJoinButton({ sessionId, joined, conflictText }: GuestJoinButtonProps) {
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

  return (
    <>
      <Button size="sm" variant={joined ? "outline" : "default"} disabled={pending} onClick={onClick}>
        {joined ? "Odhlásit se" : "Přihlásit se"}
      </Button>
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
