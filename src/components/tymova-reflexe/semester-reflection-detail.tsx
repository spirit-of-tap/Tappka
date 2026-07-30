"use client"

import { useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Accordion } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { SemesterReflectionEntryWithUpdater, TeamSemesterReflectionWithCreator } from "@/lib/tymova-reflexe/semester-types"
import { SEMESTER_REFLECTION_TOPICS } from "@/lib/tymova-reflexe/semester-topics"
import { SemesterInfoCard } from "./semester-info-card"
import { SemesterTopicEditor } from "./semester-topic-editor"

function semesterLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-")
  return month === "01" ? `Zimní semestr ${year}` : `Letní semestr ${year}`
}

interface SemesterReflectionDetailProps {
  reflection: TeamSemesterReflectionWithCreator
  entries: SemesterReflectionEntryWithUpdater[]
  profileId: string
}

export function SemesterReflectionDetail({ reflection, entries, profileId }: SemesterReflectionDetailProps) {
  const supabase = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const listenersRef = useRef(new Map<string, (incoming: SemesterReflectionEntryWithUpdater) => void>())

  const topic = `team:${reflection.team_id}:semester-reflection:${reflection.id}`

  useEffect(() => {
    const channel = supabase.current
      .channel(topic, {
        config: {
          broadcast: { self: false, ack: true },
          private: true,
        },
      })
      .on("broadcast", { event: "entry_updated" }, (message) => {
        const incoming = message.payload as SemesterReflectionEntryWithUpdater
        listenersRef.current.get(incoming.id)?.(incoming)
      })

    channelRef.current = channel

    supabase.current.realtime.setAuth().then(() => {
      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Semester reflection channel error:", err)
        }
      })
    }).catch((err) => {
      console.error("Failed to set auth for semester reflection channel:", err)
    })

    return () => {
      channelRef.current = null
      supabase.current.removeChannel(channel)
    }
  }, [topic])

  const registerListener = useCallback(
    (entryId: string, handler: (incoming: SemesterReflectionEntryWithUpdater) => void) => {
      listenersRef.current.set(entryId, handler)
      return () => {
        listenersRef.current.delete(entryId)
      }
    },
    [],
  )

  const entryByTopic = new Map(entries.map((entry) => [entry.topic, entry]))

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div className="space-y-1">
        <Link
          href="/tymova-reflexe"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Zpět na přehled
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Semestrální reflexe — {semesterLabel(reflection.semester_month)}
        </h1>
      </div>

      <SemesterInfoCard />

      <Card className="px-4 sm:px-6">
        <Accordion type="multiple" className="w-full">
          {SEMESTER_REFLECTION_TOPICS.map((topicDef) => {
            const entry = entryByTopic.get(topicDef.key)
            if (!entry) return null
            return (
              <SemesterTopicEditor
                key={topicDef.key}
                entry={entry}
                topicDef={topicDef}
                channelRef={channelRef}
                profileId={profileId}
                registerListener={registerListener}
              />
            )
          })}
        </Accordion>
      </Card>
    </div>
  )
}
