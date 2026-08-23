import { cn } from "@/lib/utils"

interface SemesterSeparatorProps {
  label: string
  semester?: "winter" | "summer"
  className?: string
}

export function SemesterSeparator({ label, semester, className }: SemesterSeparatorProps) {
  return (
    <div
      className={cn(
        "my-6 flex items-center gap-3 pt-2",
        className,
      )}
      role="separator"
      aria-label={label}
    >
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
            semester === "winter"
              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          )}
        >
          {semester === "winter" ? "ZS" : "LS"}
        </div>
        <span className="font-heading text-xs font-semibold tracking-wide text-foreground/90 uppercase">
          {label}
        </span>
      </div>
      <div aria-hidden className="h-px flex-1 bg-border/70" />
    </div>
  )
}
