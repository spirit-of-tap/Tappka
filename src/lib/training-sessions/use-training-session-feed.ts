"use client"

import { useEffect, useRef } from "react"

import { createClient } from "@/lib/supabase/client"

import { TS_REALTIME_EVENTS, TS_REALTIME_TOPIC } from "./constants"

export function useTrainingSessionFeed(onEvent: () => void): void {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const client = createClient()
    const channel = client.channel(TS_REALTIME_TOPIC, { config: { broadcast: { self: false }, private: true } })
    for (const event of Object.values(TS_REALTIME_EVENTS)) {
      channel.on("broadcast", { event }, () => onEventRef.current())
    }
    client.realtime
      .setAuth()
      .then(() =>
        channel.subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") console.error("Training session feed error:", err)
        }),
      )
      .catch((err: unknown) => console.error("Failed to set auth for training session feed:", err))
    return () => {
      void client.removeChannel(channel)
    }
  }, [])
}
