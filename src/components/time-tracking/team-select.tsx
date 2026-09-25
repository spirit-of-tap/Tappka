"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { TEAM_PARAM } from "./cas-query"

export interface TeamOption {
  id: string
  name: string
}

interface TeamSelectProps {
  teams: readonly TeamOption[]
  value: string
}

/** Team picker for coaches / admins; writes `?team=` and keeps `?w=`. */
export function TeamSelect({ teams, value }: TeamSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(teamId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(TEAM_PARAM, teamId)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger aria-label="Tým" className="w-full sm:w-56">
        <SelectValue placeholder="Vyber tým" />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
