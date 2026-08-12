"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getTeamReflectionForMonth } from "@/lib/tymova-reflexe/queries"

interface TeamReflectionCreateProps {
  teamId: string
  profileId: string
  month: string
  label: string
}

export function TeamReflectionCreate({ teamId, profileId, month, label }: TeamReflectionCreateProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: inserted, error } = await supabase
        .from("team_reflections")
        .insert({
          team_id: teamId,
          month,
          created_by_profile_id: profileId,
          updated_by_profile_id: profileId,
        })
        .select("id")
        .single()

      if (error) throw error
      router.push(`/tymova-reflexe/${inserted.id}`)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === "23505") {
        const existing = await getTeamReflectionForMonth(createClient(), teamId, month)
        if (existing) {
          toast.info("Reflexe za tento měsíc už existuje")
          router.push(`/tymova-reflexe/${existing.id}`)
          return
        }
      }
      toast.error("Nepodařilo se vytvořit reflexi")
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleCreate} disabled={loading}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      Vytvořit reflexi za {label}
    </Button>
  )
}
