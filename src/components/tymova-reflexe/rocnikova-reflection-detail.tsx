"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Accordion } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageBack } from "@/components/ui/page-back"
import { HelpDialog } from "@/components/help-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type {
  AnnualReflectionEntryWithUpdater,
  TeamAnnualReflectionWithCreator,
} from "@/lib/tymova-reflexe/semester-types"
import { ROCNIKOVA_REFLECTION_TOPICS } from "@/lib/tymova-reflexe/semester-topics"
import { RocnikovaInfoCard } from "./rocnikova-info-card"
import { SemesterTopicEditor } from "./semester-topic-editor"

function rocnikovaLabel(monthStr: string): string {
  const [year] = monthStr.split("-")
  return `Ročníková reflexe ${year}`
}

interface RocnikovaReflectionDetailProps {
  reflection: TeamAnnualReflectionWithCreator
  entries: AnnualReflectionEntryWithUpdater[]
  profileId: string
}

export function RocnikovaReflectionDetail({
  reflection,
  entries,
  profileId,
}: RocnikovaReflectionDetailProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const supabase = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const listenersRef = useRef<Map<string, (incoming: AnnualReflectionEntryWithUpdater) => void>>(
    new Map(),
  )

  const topic = `team:${reflection.team_id}:annual-reflection:${reflection.id}`

  useEffect(() => {
    const client = supabase.current
    const channel = client
      .channel(topic, {
        config: {
          broadcast: { self: false, ack: true },
          private: true,
        },
      })
      .on("broadcast", { event: "entry_updated" }, (message) => {
        const incoming = message.payload as AnnualReflectionEntryWithUpdater
        listenersRef.current.get(incoming.id)?.(incoming)
      })

    channelRef.current = channel

    client.realtime
      .setAuth()
      .then(() => {
        channel.subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") {
            console.error("Reflection channel error:", err)
          }
        })
      })
      .catch((err) => {
        console.error("Failed to set auth for reflection channel:", err)
      })

    return () => {
      channelRef.current = null
      client.removeChannel(channel)
    }
  }, [topic])

  const registerListener = useCallback(
    (entryId: string, handler: (incoming: AnnualReflectionEntryWithUpdater) => void) => {
      listenersRef.current.set(entryId, handler)
      return () => {
        listenersRef.current.delete(entryId)
      }
    },
    [],
  )

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.current
        .from("team_annual_reflections")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", reflection.id)

      if (error) throw error
      toast.success("Ročníková reflexe odstraněna")
      router.push("/tymova-reflexe")
    } catch {
      toast.error("Nepodařilo se odstranit reflexi")
      setDeleting(false)
    }
  }

  const entryByTopic = new Map(entries.map((entry) => [entry.topic, entry]))

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <PageBack href="/tymova-reflexe" label="Zpět na přehled" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {rocnikovaLabel(reflection.reflection_month)}
          </h1>
          <p className="text-xs text-muted-foreground">
            Závěrečné ročníkové ohlédnutí za všemi 11 oblastmi týmu a komunity
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HelpDialog question="Co je ročníková reflexe?">
            <RocnikovaInfoCard />
          </HelpDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Smazat ročníkovou reflexi"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline ml-1.5">Smazat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odstranit ročníkovou reflexi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce reflexi za {rocnikovaLabel(reflection.reflection_month)} odstraní včetně
                  všech vyplněných témat.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                >
                  {deleting ? "Odstraňuji..." : "Odstranit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <RocnikovaInfoCard />

      <Card className="p-3 sm:p-6">
        <Accordion type="single" collapsible className="w-full">
          {ROCNIKOVA_REFLECTION_TOPICS.map((topicDef) => {
            const entry = entryByTopic.get(topicDef.key)
            if (!entry) return null
            return (
              <SemesterTopicEditor
                key={topicDef.key}
                topicDef={topicDef}
                entry={entry}
                profileId={profileId}
                channelRef={channelRef}
                registerListener={registerListener}
              />
            )
          })}
        </Accordion>
      </Card>
    </div>
  )
}

export const SemesterReflectionDetail = RocnikovaReflectionDetail
