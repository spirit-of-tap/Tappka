import { Pencil } from "lucide-react"

const LINE_CLASS = "absolute left-4 h-1.5 origin-left rounded-full bg-muted-foreground/30"

/** A sheet being written on — the empty state while facilitation prepares the TS. */
export function PreparationInProgress() {
  return (
    <div aria-hidden className="relative mx-auto h-28 w-24 rounded-lg border bg-card shadow-xs">
      <span className="absolute left-4 top-4 h-2 w-10 rounded-full bg-primary/25" />
      <span className={`${LINE_CLASS} prep-line-1 top-9 w-16`} />
      <span className={`${LINE_CLASS} prep-line-2 top-12 w-16`} />
      <span className={`${LINE_CLASS} prep-line-3 top-15 w-10`} />
      {/* The icon's tip is its bottom-left corner: 20px tall, so top 19px puts the tip on the first line (36px + 3px). */}
      <span className="prep-pencil absolute left-4 top-[19px] block">
        <span className="prep-scribble block origin-bottom-left">
          <Pencil className="size-5 text-primary" />
        </span>
      </span>
    </div>
  )
}
