import { Check } from "lucide-react"
import { getSemesterInfo } from "@/lib/timeline/semester-utils"

export interface MetricGoal {
  current: number
  target: number
  label: string
}

export interface MetricProgressProps {
  goals: MetricGoal[]
  /** Optional current semester number (1 to 6). If omitted, computed from academic calendar. */
  currentSemester?: number
  /** Student's cohort onboarding year (e.g. 2025). Defaults to 2025. */
  onboardingYear?: number | null
  /** Optional date override for time traveling. Defaults to new Date(). */
  now?: Date
}

/**
 * Cumulative Semester Milestone Progress:
 * Focuses on what matters to the student:
 * "Where am I relative to the cumulative benchmark of my current semester (e.g. 41/40 b → +1 b surplus)?"
 */
export function MetricProgress({
  goals,
  currentSemester: explicitSemester,
  onboardingYear = 2025,
  now = new Date(),
}: MetricProgressProps) {
  const semesterGoal = goals.find((g) => g.label.toLowerCase().includes("semestr"))
  const studyGoal = goals.find((g) => g.label.toLowerCase().includes("studium"))

  const semesterTarget = semesterGoal?.target ?? 20
  const semesterCurrent = semesterGoal?.current ?? 0
  const studyTarget = studyGoal?.target ?? semesterTarget * 6
  const totalAchieved = studyGoal ? studyGoal.current : semesterCurrent

  // Calculate actual academic semester (1..6) from calendar date and cohort
  const semesterInfo = getSemesterInfo(now, onboardingYear ?? 2025)
  const computedSem = semesterInfo?.studyYear
    ? (semesterInfo.studyYear - 1) * 2 + (semesterInfo.semester === "winter" ? 1 : 2)
    : 2
  const activeSemester = explicitSemester ?? (studyGoal ? Math.min(6, Math.max(1, computedSem)) : 1)

  // Cumulative target for current semester
  const activeExpectedMilestone = studyGoal
    ? Math.min(studyTarget, activeSemester * semesterTarget)
    : semesterTarget

  const cumulativeDelta = totalAchieved - activeExpectedMilestone
  const isCumulativePassed = cumulativeDelta >= 0

  const studyPercent = studyTarget > 0 ? Math.round((totalAchieved / studyTarget) * 100) : 0

  // Current semester specific chunk progress (for mobile view)
  const activeSemStart = (activeSemester - 1) * semesterTarget
  const activeSemCurrent = Math.max(
    semesterGoal?.current ?? 0,
    Math.max(0, totalAchieved - activeSemStart),
  )
  const isSemPassed = totalAchieved >= activeExpectedMilestone || activeSemCurrent >= semesterTarget
  const semSurplus = Math.max(cumulativeDelta, activeSemCurrent - semesterTarget)
  const activeSemRemaining = Math.max(0, semesterTarget - activeSemCurrent)
  const activeSemFill = Math.min(100, Math.max(0, (activeSemCurrent / semesterTarget) * 100))

  return (
    <details className="group rounded-lg border border-border/40 bg-muted/20 p-3 text-xs transition-colors hover:bg-muted/30">
      <summary className="focus-ring cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {/* Mobile View (< sm): Current Semester Chunk */}
        <div className="space-y-1.5 sm:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{activeSemester}. semestr</span>
              {isSemPassed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success-strong">
                  <Check className="size-3.5 stroke-[2.5]" />
                  Splněno {semSurplus > 0 ? `(+${semSurplus})` : ""}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  (zbývá {activeSemRemaining})
                </span>
              )}
            </div>

            <span className="font-bold tabular-nums text-foreground">
              {activeSemCurrent}/{semesterTarget}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted/80">
            <div
              data-slot="metric-bar"
              className={`h-full rounded-full transition-all duration-300 ${
                isSemPassed ? "bg-success" : "bg-foreground/75"
              }`}
              style={{
                width: `${activeSemFill}%`,
              }}
            />
          </div>

          {studyGoal && (
            <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground/80">
              <span>Celkem: {totalAchieved}/{studyTarget}</span>
              <span>({studyPercent}%)</span>
            </div>
          )}
        </div>

        {/* Desktop View (>= sm): Header + 6-Segment Cumulative Milestone Bar */}
        <div className="hidden sm:block space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{activeSemester}. semestr</span>

              {isCumulativePassed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success-strong">
                  <Check className="size-3.5 stroke-[2.5]" />
                  Splněno {cumulativeDelta > 0 ? `(+${cumulativeDelta} navíc)` : ""}
                </span>
              ) : (
                <span className="font-medium text-muted-foreground">
                  (zbývá {Math.abs(cumulativeDelta)} b do cíle semestru)
                </span>
              )}

              <span className="font-bold tabular-nums text-foreground">
                {totalAchieved}/{activeExpectedMilestone}
              </span>
            </div>

            <div className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
              <span>{studyGoal?.label ?? "za studium"}</span>
              <span className="font-bold text-foreground">
                {totalAchieved}/{studyTarget}
              </span>
              <span className="text-[11px]">({studyPercent}%)</span>

              {/* Accessible fallback for semester label */}
              {semesterGoal && (
                <span className="sr-only">{semesterGoal.label}</span>
              )}
            </div>
          </div>

          {/* 6-Segment Cumulative Milestone Bar */}
          <div className="grid grid-cols-6 gap-1.5 pt-0.5">
            {[1, 2, 3, 4, 5, 6].map((sem) => {
              const semMilestone = sem * semesterTarget
              const semStart = (sem - 1) * semesterTarget
              const semFill = Math.min(
                100,
                Math.max(0, ((totalAchieved - semStart) / semesterTarget) * 100),
              )
              const isDone = semFill >= 100
              const isActiveSem = sem === activeSemester
              const isNextTarget = !isDone && totalAchieved >= semStart

              return (
                <div key={sem} className="space-y-1">
                  <div
                    title={`Milník ${semMilestone} b (${sem}. semestr): ${Math.round(semFill)}%`}
                    className={`h-2 overflow-hidden rounded-full transition-all ${
                      isActiveSem
                        ? "bg-muted ring-2 ring-primary/40 shadow-xs"
                        : isDone
                          ? "bg-muted/80"
                          : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div
                      data-slot="metric-bar"
                      className={`h-full rounded-full transition-all duration-300 ${
                        isDone ? "bg-success" : "bg-foreground/75"
                      }`}
                      style={{ width: `${semFill}%` }}
                    />
                  </div>

                  {/* Milestone number placed at the RIGHT end of each segment */}
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] tabular-nums pr-0.5 transition-colors ${
                      isActiveSem
                        ? "font-bold text-foreground"
                        : isDone
                          ? "font-medium text-foreground"
                          : isNextTarget
                            ? "font-semibold text-foreground"
                            : "font-normal text-muted-foreground/40"
                    }`}
                  >
                    {isActiveSem && <span className="size-1.5 rounded-full bg-primary" />}
                    <span>{semMilestone}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </summary>

      <p className="mt-2.5 border-t border-border/30 pt-2 text-xs leading-relaxed text-muted-foreground">
        Cíl studia se načítá kumulativně: 1. semestr ({semesterTarget}) → 2. semestr ({semesterTarget * 2}) → 3. semestr ({semesterTarget * 3}) → 4. semestr ({semesterTarget * 4}) → 5. semestr ({semesterTarget * 5}) → 6. semestr ({studyTarget}).
      </p>
    </details>
  )
}

