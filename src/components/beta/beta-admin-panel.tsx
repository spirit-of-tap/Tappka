"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface BetaParticipant {
  id: string
  name: string | null
  work_email: string
  beta_cohort: "A" | "B"
  team_id?: string | null
}

interface BetaAdminPanelProps {
  participants: BetaParticipant[]
}

export function BetaAdminPanel({ participants: initial }: BetaAdminPanelProps) {
  const router = useRouter()
  const [rows, setRows] = useState<BetaParticipant[]>(initial)
  const [search, setSearch] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        p.work_email.toLowerCase().includes(q),
    )
  }, [rows, search])

  const handleCohortChange = async (profileId: string, value: "A" | "B") => {
    const prev = rows.find((r) => r.id === profileId)?.beta_cohort
    if (prev === value) return
    setRows((cur) => cur.map((r) => (r.id === profileId ? { ...r, beta_cohort: value } : r)))
    setSavingId(profileId)
    try {
      const res = await fetch("/api/admin/beta-cohort", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, beta_cohort: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Chyba")
      }
      toast.success("Kohorta uložena")
      router.refresh()
    } catch {
      setRows((cur) => cur.map((r) => (r.id === profileId ? { ...r, beta_cohort: prev ?? "A" } : r)))
      toast.error("Nepodařilo se uložit")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Beta účastníci:ice</CardTitle>
          <CardDescription>Spravuj přiřazení do kohort A a B. Vyhledávání podle jména nebo e-mailu.</CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Hledat podle jména nebo e-mailu"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Hledat podle jména nebo e-mailu"
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jméno</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-[140px]">Kohorta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Žádní účastníci:ice neodpovídají vyhledávání
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.work_email}</TableCell>
                    <TableCell>
                      <Select
                        value={p.beta_cohort}
                        onValueChange={(v) => handleCohortChange(p.id, v as "A" | "B")}
                        disabled={savingId === p.id}
                      >
                        <SelectTrigger className="w-[100px]" aria-label={`Kohorta pro ${p.name ?? p.work_email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A — Čtení</SelectItem>
                          <SelectItem value="B">B — Vše</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          A vidí pouze Čtení. B vidí všechny beta funkce. Změna se projeví po obnovení.
        </p>
      </CardContent>
    </Card>
    </div>
  )
}
