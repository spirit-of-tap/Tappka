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
      variant="ghost"
      size="sm"
      type="button"
      onClick={open}
      aria-label="Rychlé vyhledávání (Klávesová zkratka ⌘K)"
      className={cn(
        "group relative flex h-9 w-full items-center justify-between gap-2 rounded-xl bg-sidebar-accent/60 px-3 text-sm text-muted-foreground motion-safe:transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-1 focus-visible:ring-sidebar-ring",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0 opacity-70" />
        <span className="truncate font-normal">{placeholder}</span>
      </div>
      <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded px-1 font-medium text-muted-foreground opacity-70 sm:inline-flex">
        <span className="text-[11px] leading-none">⌘</span>
        <span className="font-mono text-[10px] leading-none">K</span>
      </kbd>
    </Button>
  );
}
