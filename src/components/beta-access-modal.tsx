"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface BetaAccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialBetaAccess: boolean
}

export function BetaAccessModal({ open, onOpenChange, initialBetaAccess }: BetaAccessModalProps) {
  const router = useRouter()
  const [betaAccess, setBetaAccess] = useState(initialBetaAccess)
  const [saving, setSaving] = useState(false)

  const handleToggle = async (value: boolean) => {
    setSaving(true)
    setBetaAccess(value)

    try {
      const res = await fetch("/api/profile/beta-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beta_access: value }),
      })

      if (!res.ok) {
        setBetaAccess(!value)
      }

      router.refresh()
    } catch {
      setBetaAccess(!value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" />
            Beta přístup
          </DialogTitle>
          <DialogDescription>
            Zapni beta přístup a získej jako první přístup k novým funkcím. Zároveň nám pomůžeš
            s jejich vylepšováním — můžeme se na tebe obrátit se zpětnou vazbou.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="beta-access">Beta přístup</Label>
            <p className="text-sm text-muted-foreground">
              Přednostní přístup k novým funkcím
            </p>
          </div>
          <Switch
            id="beta-access"
            checked={betaAccess}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
