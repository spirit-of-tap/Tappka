export interface MetricGoal {
  current: number
  target: number
  label: string
}

/**
 * Compact goal-progress strip: thin bars + "current/target" figures.
 * Wrapped in a native <details> so the explainer costs zero JS.
 */
export function MetricProgress({ goals }: { goals: MetricGoal[] }) {
  return (
    <details className="group rounded-lg border border-border/50 bg-muted/30">
      <summary className="focus-ring cursor-pointer list-none space-y-1.5 p-3 [&::-webkit-details-marker]:hidden">
        {goals.map((goal) => (
          <div key={goal.label} className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                data-slot="metric-bar"
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(100, Math.max(0, (goal.current / goal.target) * 100))}%`,
                }}
              />
            </div>
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">
                {goal.current}/{goal.target}
              </span>{" "}
              {goal.label}
            </p>
          </div>
        ))}
      </summary>
      <p className="border-t border-border/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Cíl vychází z nastavených metrik Tiimiakatemia. Semestr = zimní (září–leden) a letní
        (únor–srpen).
      </p>
    </details>
  )
}
