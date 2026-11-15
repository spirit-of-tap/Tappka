import { ArrowRight, Link2 } from "lucide-react"

const SHEET_CLASS = "absolute top-0 h-24 w-20 rounded-lg border bg-card shadow-xs"
const LINE_CLASS = "absolute left-3 h-1.5 rounded-full"
const SOURCE_LINE_CLASS = `${LINE_CLASS} bg-muted-foreground/20`
const TARGET_LINE_CLASS = `${LINE_CLASS} origin-left bg-muted-foreground/30`
const FLYING_LINE_CLASS = `${LINE_CLASS} bg-primary/50 opacity-0`
const CAPTION_CLASS = "absolute top-[100px] w-20 text-center text-[11px] text-muted-foreground"

/**
 * An outside document's lines copy over into a Tappka sheet — the link-only
 * preparation nudge. The target sheet sits 128px right of the source, which
 * is the distance the `prep-move-fly-*` keyframes travel.
 * Without motion both sheets are simply shown filled in.
 */
export function PreparationMoveIllustration() {
  return (
    <div aria-hidden className="relative mx-auto h-[116px] w-52">
      {/* Source: a document living somewhere else */}
      <div className={`${SHEET_CLASS} left-0 border-dashed`}>
        <span className="absolute left-3 top-3 flex size-5 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <Link2 className="size-3" />
        </span>
        <span className={`${SOURCE_LINE_CLASS} top-9 w-14`} />
        <span className={`${SOURCE_LINE_CLASS} top-12 w-14`} />
        <span className={`${SOURCE_LINE_CLASS} top-15 w-9`} />
      </div>
      <span className={`${CAPTION_CLASS} left-0`}>Odkaz</span>

      <ArrowRight className="prep-move-arrow absolute left-[94px] top-3 size-5 text-muted-foreground/60" />

      {/* Target: the preparation in Tappka */}
      <div className={`${SHEET_CLASS} left-32 border-primary/40`}>
        <span className="absolute left-3 top-4 h-2 w-10 rounded-full bg-primary/25" />
        <span className={`${TARGET_LINE_CLASS} prep-move-land-1 top-9 w-14`} />
        <span className={`${TARGET_LINE_CLASS} prep-move-land-2 top-12 w-14`} />
        <span className={`${TARGET_LINE_CLASS} prep-move-land-3 top-15 w-9`} />
      </div>
      <span className={`${CAPTION_CLASS} left-32 font-medium text-primary`}>Tappka</span>

      {/* Copies in flight, above both sheets */}
      <span className={`${FLYING_LINE_CLASS} prep-move-fly-1 top-9 w-14`} />
      <span className={`${FLYING_LINE_CLASS} prep-move-fly-2 top-12 w-14`} />
      <span className={`${FLYING_LINE_CLASS} prep-move-fly-3 top-15 w-9`} />
    </div>
  )
}
