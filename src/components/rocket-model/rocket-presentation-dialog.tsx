"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Radio,
  X,
} from "lucide-react"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { formatRocketDateTime } from "@/lib/rocket-model/datetime"
import { coveragePercent } from "@/lib/rocket-model/progress"
import type {
  RocketCategoryWithItems,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { cn } from "@/lib/utils"

export interface RocketPresentationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: RocketCategoryWithItems[]
  teamMembers: TeamMemberProfile[]
  states: RocketIndividualState[]
  teamChecks: RocketTeamCheck[]
  profileId: string
  initialItemId?: string | null
  activePresentationItemId?: string | null
  onActiveItemChange?: (itemId: string | null) => void
  onToggleIndividual: (itemId: string, checked: boolean) => Promise<void>
  defaultFullscreen?: boolean
}

export function RocketPresentationDialog({
  open,
  onOpenChange,
  categories,
  teamMembers,
  states,
  teamChecks: _teamChecks,
  profileId,
  initialItemId,
  activePresentationItemId,
  onActiveItemChange,
  onToggleIndividual,
  defaultFullscreen = true,
}: RocketPresentationDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen)

  // Flatten all items across categories in natural order
  const flatItems = useMemo(() => {
    return categories.flatMap((category) =>
      category.items.map((item) => ({
        item,
        category,
      })),
    )
  }, [categories])

  // User navigation override
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Determine current effective item
  const effectiveItemId = useMemo(() => {
    if (selectedItemId && flatItems.some((entry) => entry.item.id === selectedItemId)) {
      return selectedItemId
    }
    if (activePresentationItemId && flatItems.some((entry) => entry.item.id === activePresentationItemId)) {
      return activePresentationItemId
    }
    if (initialItemId && flatItems.some((entry) => entry.item.id === initialItemId)) {
      return initialItemId
    }
    return flatItems[0]?.item.id ?? null
  }, [selectedItemId, activePresentationItemId, initialItemId, flatItems])

  const currentIndex = useMemo(() => {
    const idx = flatItems.findIndex((entry) => entry.item.id === effectiveItemId)
    return idx >= 0 ? idx : 0
  }, [flatItems, effectiveItemId])

  const currentSlide = flatItems[currentIndex]

  // Broadcast active item when open, and clean up on close
  useEffect(() => {
    if (!open) return
    if (effectiveItemId) {
      onActiveItemChange?.(effectiveItemId)
    }
    return () => {
      onActiveItemChange?.(null)
    }
  }, [open, effectiveItemId, onActiveItemChange])

  const handleClose = useCallback(() => {
    setSelectedItemId(null)
    onOpenChange(false)
  }, [onOpenChange])

  const goToNext = useCallback(() => {
    if (currentIndex < flatItems.length - 1) {
      const nextId = flatItems[currentIndex + 1].item.id
      setSelectedItemId(nextId)
      onActiveItemChange?.(nextId)
    }
  }, [currentIndex, flatItems, onActiveItemChange])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevId = flatItems[currentIndex - 1].item.id
      setSelectedItemId(prevId)
      onActiveItemChange?.(prevId)
    }
  }, [currentIndex, flatItems, onActiveItemChange])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault()
        goToNext()
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault()
        goToPrev()
      } else if (event.key === "Escape") {
        handleClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, goToNext, goToPrev, handleClose])

  // State calculations for the current item
  const { isOwnChecked, checkersCount, isUnanimous } = useMemo(() => {
    if (!currentSlide) {
      return { isOwnChecked: false, checkersCount: 0, isUnanimous: false }
    }

    const memberIdSet = new Set(teamMembers.map((m) => m.id))
    let count = 0
    let own = false

    for (const state of states) {
      if (state.item_id === currentSlide.item.id && state.is_checked) {
        if (memberIdSet.size === 0 || memberIdSet.has(state.profile_id)) {
          count += 1
        }
        if (state.profile_id === profileId) {
          own = true
        }
      }
    }

    return {
      isOwnChecked: own,
      checkersCount: count,
      isUnanimous: teamMembers.length > 0 && count === teamMembers.length,
    }
  }, [currentSlide, states, teamMembers, profileId])

  const stateByMemberId = useMemo(() => {
    if (!currentSlide) return new Map<string, RocketIndividualState>()
    const map = new Map<string, RocketIndividualState>()
    for (const state of states) {
      if (state.item_id === currentSlide.item.id) {
        map.set(state.profile_id, state)
      }
    }
    return map
  }, [currentSlide, states])

  if (flatItems.length === 0 || !currentSlide) {
    return null
  }

  const progressPercent = coveragePercent(checkersCount, teamMembers.length)
  const slideProgressPercent = Math.round(((currentIndex + 1) / flatItems.length) * 100)

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          handleClose()
        } else {
          onOpenChange(true)
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "bg-background text-foreground transition-all duration-150 p-0 overflow-hidden",
          isFullscreen
            ? "fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none sm:max-w-none max-h-none rounded-none border-none flex flex-col z-50"
            : "max-w-4xl max-h-[90vh] flex flex-col rounded-xl",
        )}
      >
        <DialogTitle className="sr-only">
          Prezentace Rocket Modelu — {currentSlide.item.text_cs}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Režim prezentace pro procházení položek Rocket Modelu a zobrazení stavu týmu v reálném čase.
        </DialogDescription>

        {/* Top Navigation Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/60 shrink-0 bg-background/90 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className="font-mono font-medium text-xs px-2 py-0.5 shrink-0"
            >
              {currentSlide.category.code}
            </Badge>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {currentSlide.category.title}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Badge
              variant="secondary"
              className="gap-1.5 border-none bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary shrink-0"
            >
              <Radio className="size-2.5 text-primary animate-pulse" />
              <span className="hidden sm:inline">Živá prezentace</span>
              <span className="tabular-nums">
                {currentIndex + 1} / {flatItems.length}
              </span>
            </Badge>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsFullscreen((prev) => !prev)}
              aria-label={isFullscreen ? "Ukončit celou obrazovku" : "Režim celé obrazovky"}
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleClose}
              aria-label="Zavřít prezentaci"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Main Slide Body */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto px-4 sm:px-8 md:px-12 py-6 sm:py-8">
          <div className="flex flex-col items-center text-center my-auto">
            {/* Category Breadcrumb */}
            <p className="text-xs sm:text-sm uppercase tracking-wider font-semibold text-primary mb-2 sm:mb-3">
              {currentSlide.category.title}
            </p>

            {/* Giant Item Text */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-center leading-tight tracking-tight text-foreground max-w-4xl mx-auto">
              {currentSlide.item.text_cs}
            </h1>

            {/* Status and Action Row */}
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 shadow-2xs">
                <span className="text-xs sm:text-sm font-semibold tabular-nums">
                  {checkersCount} z {teamMembers.length}
                </span>
                <span className="text-xs text-muted-foreground">má splněno</span>
                <Progress
                  value={progressPercent}
                  className="h-1.5 w-16 sm:w-24 ml-1"
                  indicatorClassName={isUnanimous ? "bg-success" : undefined}
                />
              </div>

              {isUnanimous ? (
                <Badge
                  variant="secondary"
                  className="border-none bg-success/20 text-success-strong px-3 py-1.5 text-xs sm:text-sm font-semibold gap-1.5 shadow-2xs"
                >
                  <Check className="size-4 stroke-[2.5]" />
                  Celý tým splnil
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="border-none bg-muted px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground"
                >
                  Čeká na tým
                </Badge>
              )}

              {/* Personal Check Button on the Slide */}
              <Button
                variant={isOwnChecked ? "secondary" : "default"}
                size="sm"
                onClick={() => onToggleIndividual(currentSlide.item.id, !isOwnChecked)}
                className={cn(
                  "gap-1.5 font-medium transition-all shadow-2xs",
                  isOwnChecked && "bg-success/20 text-success-strong hover:bg-success/30 border-success/30",
                )}
              >
                {isOwnChecked ? (
                  <>
                    <Check className="size-4 stroke-[2.5]" />
                    Máš splněno
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Označit za splněné
                  </>
                )}
              </Button>
            </div>

            {/* People Grid */}
            <div className="mt-8 sm:mt-10 w-full max-w-4xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left sm:text-center mb-3">
                Zapojení týmu
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {teamMembers.map((member) => {
                  const memberState = stateByMemberId.get(member.id)
                  const isChecked = memberState?.is_checked ?? false

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex flex-col items-center text-center p-3 rounded-xl border transition-all duration-150",
                        isChecked
                          ? "border-success/40 bg-success/[0.06] text-foreground ring-1 ring-success/20 shadow-2xs"
                          : "border-border/60 bg-muted/15 opacity-60 text-muted-foreground",
                      )}
                    >
                      <div className="relative">
                        <ProfileAvatar
                          picture={member.picture}
                          name={member.name}
                          size={44}
                        />
                        {isChecked && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-background">
                            <Check className="size-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs sm:text-sm font-semibold truncate max-w-full">
                        {member.name ?? "Neznámý:á"}
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "mt-1 text-[11px] font-medium border-none py-0.5 px-2",
                          isChecked
                            ? "bg-success/20 text-success-strong"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isChecked ? "Splněno" : "Zatím ne"}
                      </Badge>
                      {isChecked && memberState && (
                        <span className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                          {formatRocketDateTime(new Date(memberState.updated_at))}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Slide Controller Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border/60 bg-background/90 backdrop-blur-xs shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="gap-1.5 h-8 sm:h-9"
          >
            <ChevronLeft className="size-4" />
            <span>Předchozí</span>
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
              (←)
            </span>
          </Button>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {currentIndex + 1} / {flatItems.length}
            </span>
            <Progress
              value={slideProgressPercent}
              className="h-1 w-24 sm:w-40"
            />
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={goToNext}
            disabled={currentIndex === flatItems.length - 1}
            className="gap-1.5 h-8 sm:h-9"
          >
            <span>Další</span>
            <ChevronRight className="size-4" />
            <span className="hidden sm:inline text-xs opacity-75 font-mono">
              (→)
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
