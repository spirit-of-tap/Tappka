"use client"

import { ExternalLink } from "lucide-react"
import { useSyncExternalStore, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

const MAC_PLATFORM_PATTERN = /Mac|iPhone|iPad/

function subscribeNever(): () => void {
  return () => {}
}

/** ⌘ on Apple devices, Ctrl elsewhere; Ctrl during SSR. */
function useModifierKey(): string {
  const isMac = useSyncExternalStore(
    subscribeNever,
    () => MAC_PLATFORM_PATTERN.test(navigator.userAgent),
    () => false,
  )
  return isMac ? "⌘" : "Ctrl"
}

function Shortcut({ modifier, letter }: { modifier: string; letter: string }) {
  return (
    <KbdGroup>
      <Kbd>{modifier}</Kbd>
      <Kbd>{letter}</Kbd>
    </KbdGroup>
  )
}

interface LinkOnlyPreparationStepsProps {
  /** The outside document, offered as a one-click open. */
  href: string | null
}

/** How to bring an outside document's content into the preparation — three copy-paste steps. */
export function LinkOnlyPreparationSteps({ href }: LinkOnlyPreparationStepsProps) {
  const modifier = useModifierKey()

  return (
    <ol className="space-y-2 text-sm">
      <li className="flex flex-wrap items-center gap-2">
        <StepNumber>1</StepNumber>
        {href ? (
          <Button asChild variant="outline" size="sm" className="h-7">
            <a href={href} target="_blank" rel="noopener noreferrer">
              Otevři dokument
              <ExternalLink aria-hidden />
            </a>
          </Button>
        ) : (
          <span>Otevři dokument</span>
        )}
      </li>
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StepNumber>2</StepNumber>
        <span>Označ vše</span>
        <Shortcut modifier={modifier} letter="A" />
        <span>a zkopíruj</span>
        <Shortcut modifier={modifier} letter="C" />
      </li>
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StepNumber>3</StepNumber>
        <span>Vlož sem</span>
        <Shortcut modifier={modifier} letter="V" />
        <span className="text-muted-foreground">– nadpisy, seznamy i tabulky zůstanou</span>
      </li>
    </ol>
  )
}

function StepNumber({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
    >
      {children}
    </span>
  )
}
