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

interface RocnikovaReflectionCreateProps {
  teamId: string
  profileId: string
  semesterMonth: string
  label: string
}

export function RocnikovaReflectionCreate({
  teamId,
  profileId,
  semesterMonth,
  label,
}: RocnikovaReflectionCreateProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { id } = await createSemesterReflection(supabase, teamId, semesterMonth, profileId)
      router.push(`/tymova-reflexe/rocnikova/${id}`)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === "23505") {
        const existing = await getSemesterReflectionForTeamMonth(createClient(), teamId, semesterMonth)
        if (existing) {
          toast.info("Ročníková reflexe za toto období už existuje")
          router.push(`/tymova-reflexe/rocnikova/${existing.id}`)
          return
        }
      }
      toast.error("Nepodařilo se založit ročníkovou reflexi")
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
