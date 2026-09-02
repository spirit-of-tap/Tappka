"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Switch } from "@/components/ui/switch"

interface NotificationPreferencesFormProps {
  initialCoachReadEmail: boolean
  initialCommentEmail: boolean
  initialVoteEmail: boolean
  initialBookSubmittedEmail: boolean
}

type ToggleKey = "essay_coach_read_email" | "essay_comment_email" | "essay_vote_email" | "book_submitted_email"

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "essay_coach_read_email", label: "Kouč:ka přečetl:a tvou esej" },
  { key: "essay_comment_email", label: "Nový komentář na tvou esej" },
  { key: "essay_vote_email", label: "Nový like na tvou esej" },
  { key: "book_submitted_email", label: "Nová kniha ke schválení" },
]

export function NotificationPreferencesForm({
  initialCoachReadEmail,
  initialCommentEmail,
  initialVoteEmail,
  initialBookSubmittedEmail,
}: NotificationPreferencesFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<Record<ToggleKey, boolean>>({
    essay_coach_read_email: initialCoachReadEmail,
    essay_comment_email: initialCommentEmail,
    essay_vote_email: initialVoteEmail,
    book_submitted_email: initialBookSubmittedEmail,
  })
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null)

  const handleToggle = async (key: ToggleKey, value: boolean) => {
    setSavingKey(key)
    setValues((prev) => ({ ...prev, [key]: value }))

    try {
      const res = await fetch("/api/profile/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        setValues((prev) => ({ ...prev, [key]: !value }))
      }
      router.refresh()
    } catch {
      setValues((prev) => ({ ...prev, [key]: !value }))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      {TOGGLES.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
          <span className="text-sm">{label}</span>
          <Switch
            aria-label={label}
            checked={values[key]}
            onCheckedChange={(value) => handleToggle(key, value)}
            disabled={savingKey === key}
          />
        </div>
      ))}
    </div>
  )
}
