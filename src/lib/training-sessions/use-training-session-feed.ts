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
    let cancelled = false
    let hasSubscribed = false
    let connectionLossReported = false
    const client = createClient()
    const channel = client.channel(TS_REALTIME_TOPIC, { config: { broadcast: { self: false }, private: true } })
    for (const event of Object.values(TS_REALTIME_EVENTS)) {
      channel.on("broadcast", { event }, () => onEventRef.current())
    }
    client.realtime
      .setAuth()
      .then(() => {
        if (cancelled) return
        channel.subscribe((status, err) => {
          if (cancelled) return
          if (status === "SUBSCRIBED") {
            // Events broadcast while the socket was down are lost, so refresh once
            // when a reconnect succeeds and let the server-rendered feed catch up.
            if (hasSubscribed) onEventRef.current()
            hasSubscribed = true
            connectionLossReported = false
            return
          }
          if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") return
          if (err) {
            console.error("Training session feed error:", err)
            return
          }
          // A transport drop has no error attached: realtime re-joins on its own,
          // so report the outage once instead of an error per retry.
          if (connectionLossReported) return
          connectionLossReported = true
          console.warn("Training session feed disconnected, retrying")
        })
      })
      .catch((err: unknown) => console.error("Failed to set auth for training session feed:", err))
    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [])
}
