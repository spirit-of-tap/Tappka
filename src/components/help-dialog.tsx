"use client"

import { CircleHelp, Info } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"

interface HelpDialogProps {
  /** Accessible name of the trigger and the dialog heading, e.g. "Co jsou zákaznické schůzky?". */
  question: string
  /** Card content — typically the feature's InfoCard. */
  children: ReactNode
}

/**
 * The wiki-sheet explainer behind a "?" icon in the page header, one tap away
 * instead of pinned above the content. Every module explainer goes through
 * here so the affordance looks and behaves identically everywhere.
 */
export function HelpDialog({ question, children }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          aria-label={question}
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info aria-hidden className="size-4 text-muted-foreground" />
            {question}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
