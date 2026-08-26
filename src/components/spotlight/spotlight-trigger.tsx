"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpotlight } from "./spotlight-context";

export interface SpotlightTriggerProps {
  className?: string;
  placeholder?: string;
}

export function SpotlightTrigger({
  className,
  placeholder = "Rychlé hledání...",
}: SpotlightTriggerProps) {
  const { open } = useSpotlight();

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={open}
      aria-label="Rychlé vyhledávání (Klávesová zkratka ⌘K)"
      className={cn(
        "group relative flex w-full items-center justify-between gap-2 rounded-lg border-sidebar-border bg-sidebar-accent/50 px-2.5 py-1.5 text-xs text-muted-foreground shadow-2xs transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-border/80 focus-visible:border-sidebar-ring focus-visible:ring-1 focus-visible:ring-sidebar-ring",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Search className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:scale-105" />
        <span className="truncate font-normal">{placeholder}</span>
      </div>
      <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border/70 bg-background/80 px-1.5 font-medium text-muted-foreground shadow-2xs sm:inline-flex">
        <span className="text-[11px] leading-none">⌘</span>
        <span className="font-mono text-[10px] leading-none">K</span>
      </kbd>
    </Button>
  );
}
