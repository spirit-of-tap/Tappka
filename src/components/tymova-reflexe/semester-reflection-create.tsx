"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  createSemesterReflection,
  getSemesterReflectionForTeamMonth,
} from "@/lib/tymova-reflexe/semester-queries"

interface SemesterReflectionCreateProps {
  teamId: string
  profileId: string
  semesterMonth: string
  label: string
}

export function SemesterReflectionCreate({
  teamId,
  profileId,
  semesterMonth,
  label,
}: SemesterReflectionCreateProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { id } = await createSemesterReflection(supabase, teamId, semesterMonth, profileId)
      router.push(`/tymova-reflexe/semestralni/${id}`)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === "23505") {
        const existing = await getSemesterReflectionForTeamMonth(createClient(), teamId, semesterMonth)
        if (existing) {
          toast.info("Reflexe za toto období už existuje")
          router.push(`/tymova-reflexe/semestralni/${existing.id}`)
          return
        }
      }
      toast.error("Nepodařilo se založit semestrální reflexi")
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleCreate} disabled={loading}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      Založit reflexi za {label}
    </Button>
  )
}
