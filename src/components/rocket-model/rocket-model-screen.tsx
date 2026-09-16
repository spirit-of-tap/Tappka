"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { setIndividualCheck, setTeamCheck } from "@/lib/rocket-model/queries"
import {
  ROCKET_INDIVIDUAL_UPDATED_EVENT,
  ROCKET_TEAM_UPDATED_EVENT,
  rocketTopic,
  type RocketCategoryWithItems,
  type RocketHistoryEntry,
  type RocketIndividualBroadcast,
  type RocketIndividualState,
  type RocketTeamBroadcast,
  type RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { RocketModelView } from "./rocket-model-view"

interface RocketModelScreenProps {
  initialCategories: RocketCategoryWithItems[]
  teamMembers: TeamMemberProfile[]
  initialStates: RocketIndividualState[]
  initialTeamChecks: RocketTeamCheck[]
  history: RocketHistoryEntry[]
  profileId: string
  teamId: string
}

async function sendRocketBroadcast<T extends Record<string, unknown>>(
  channel: RealtimeChannel | null,
  event: string,
  payload: T,
): Promise<void> {
  if (!channel) return

  try {
    if (channel.state === "joined") {
      await channel.send({
        type: "broadcast",
        event,
        payload,
      })
    } else {
      await channel.httpSend(event, payload)
    }
  } catch (err) {
    console.warn(`Failed to broadcast ${event}:`, err)
  }
}

export function RocketModelScreen({
  initialCategories,
  teamMembers,
  initialStates,
  initialTeamChecks,
  history,
  profileId,
  teamId,
}: RocketModelScreenProps) {
  const [states, setStates] = useState(initialStates)
  const [teamChecks, setTeamChecks] = useState(initialTeamChecks)
  const supabase = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const handleToggleIndividual = useCallback(
    async (itemId: string, checked: boolean) => {
      const snapshot = states
      setStates((prev) => {
        const rest = prev.filter(
          (state) => !(state.item_id === itemId && state.profile_id === profileId),
        )
        if (!checked) return rest
        const now = new Date().toISOString()
        return [
          ...rest,
          {
            item_id: itemId,
            profile_id: profileId,
            is_checked: true,
            created_at: now,
            updated_at: now,
          },
        ]
      })

      try {
        await setIndividualCheck(supabase.current, { itemId, profileId, isChecked: checked })
      } catch {
        setStates(snapshot)
        toast.error("Nepodařilo se uložit hodnocení")
        return
      }

      await sendRocketBroadcast(channelRef.current, ROCKET_INDIVIDUAL_UPDATED_EVENT, {
        item_id: itemId,
        profile_id: profileId,
        is_checked: checked,
      } satisfies RocketIndividualBroadcast)
    },
    [states, profileId],
  )

  const handleToggleTeam = useCallback(
    async (itemId: string, checked: boolean) => {
      const snapshot = teamChecks
      const now = new Date().toISOString()
      setTeamChecks((prev) => {
        const rest = prev.filter(
          (check) => !(check.team_id === teamId && check.item_id === itemId),
        )
        return [
          ...rest,
          {
            team_id: teamId,
            item_id: itemId,
            is_checked: checked,
            checked_by_profile_id: profileId,
            created_at: now,
            updated_at: now,
          },
        ]
      })

      try {
        await setTeamCheck(supabase.current, { teamId, itemId, isChecked: checked, profileId })
      } catch {
        setTeamChecks(snapshot)
        toast.error("Nepodařilo se uložit týmové hodnocení")
        return
      }

      await sendRocketBroadcast(channelRef.current, ROCKET_TEAM_UPDATED_EVENT, {
        team_id: teamId,
        item_id: itemId,
        is_checked: checked,
        checked_by_profile_id: profileId,
      } satisfies RocketTeamBroadcast)
    },
    [teamChecks, teamId, profileId],
  )

  useEffect(() => {
    const client = supabase.current
    const topic = rocketTopic(teamId)
    const channel = client
      .channel(topic, {
        config: {
          broadcast: { self: false, ack: true },
          private: true,
        },
      })
      .on("broadcast", { event: ROCKET_INDIVIDUAL_UPDATED_EVENT }, (message) => {
        const payload = message.payload as RocketIndividualBroadcast
        setStates((prev) => {
          const rest = prev.filter(
            (state) => !(state.item_id === payload.item_id && state.profile_id === payload.profile_id),
          )
          if (!payload.is_checked) return rest
          const now = new Date().toISOString()
          return [
            ...rest,
            {
              item_id: payload.item_id,
              profile_id: payload.profile_id,
              is_checked: true,
              created_at: now,
              updated_at: now,
            },
          ]
        })
      })
      .on("broadcast", { event: ROCKET_TEAM_UPDATED_EVENT }, (message) => {
        const payload = message.payload as RocketTeamBroadcast
        const now = new Date().toISOString()
        setTeamChecks((prev) => [
          ...prev.filter(
            (check) => !(check.team_id === payload.team_id && check.item_id === payload.item_id),
          ),
          {
            team_id: payload.team_id,
            item_id: payload.item_id,
            is_checked: payload.is_checked,
            checked_by_profile_id: payload.checked_by_profile_id,
            created_at: now,
            updated_at: now,
          },
        ])
        if (payload.is_checked && payload.checked_by_profile_id !== profileId) {
          const itemText = initialCategories
            .flatMap((category) => category.items)
            .find((item) => item.id === payload.item_id)?.text_cs
          toast.success("Tým dosáhl shody", {
            description: itemText ?? "Položka byla potvrzena týmem.",
          })
        }
      })

    channelRef.current = channel

    client.realtime
      .setAuth()
      .then(() => {
        channel.subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") {
            console.error("Rocket Model channel error:", err)
          }
        })
      })
      .catch((err) => {
        console.error("Failed to set auth for Rocket Model channel:", err)
      })

    return () => {
      channelRef.current = null
      client.removeChannel(channel)
    }
  }, [teamId, profileId, initialCategories])

  return (
    <RocketModelView
      categories={initialCategories}
      teamMembers={teamMembers}
      states={states}
      teamChecks={teamChecks}
      history={history}
      profileId={profileId}
      onToggleIndividual={handleToggleIndividual}
      onToggleTeam={handleToggleTeam}
    />
  )
}
