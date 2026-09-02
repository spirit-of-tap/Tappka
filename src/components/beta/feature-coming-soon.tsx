import { CookingPot, Droplets } from "lucide-react"

interface FeatureComingSoonProps {
  featureName: string
}

export function FeatureComingSoon({ featureName }: FeatureComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12 text-center sm:py-16">
      <div
        data-testid="cooking-animation"
        aria-hidden="true"
        className="relative flex flex-col items-center"
      >
        {/* Steam curls + dropping droplet */}
        <div className="relative flex h-10 w-24 items-end justify-center gap-3">
          {/* Droplet falling into pot */}
          <Droplets
            className="absolute left-1/2 top-0 size-4 -translate-x-1/2 text-primary motion-safe:animate-[drop_2.2s_ease-in-out_infinite] motion-reduce:animate-none"
            aria-hidden="true"
          />
          {/* Two steam curls */}
          <span
            className="h-6 w-1.5 rounded-full bg-muted-foreground/30 motion-safe:animate-[steam_2s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ animationDelay: "0s" }}
            aria-hidden="true"
          />
          <span
            className="h-8 w-1.5 rounded-full bg-muted-foreground/30 motion-safe:animate-[steam_2s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ animationDelay: "0.4s" }}
            aria-hidden="true"
          />
        </div>

        {/* Pot icon */}
        <div className="flex size-20 items-center justify-center rounded-2xl border bg-muted shadow-sm">
          <CookingPot className="size-10 text-primary" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          V kuchyni se něco chystá
        </h2>
        <p
          className="text-sm leading-relaxed text-muted-foreground sm:text-base"
          aria-hidden="true"
        >
          Funkce <span className="font-semibold text-foreground">{featureName}</span> právě
          probublává v našem hrnci. Až bude správně dochucená, naservírujeme ji.
        </p>
        {/* Plain text for testing-library when feature name is wrapped in an element */}
        <span className="sr-only">
          Funkce {featureName} právě probublává v našem hrnci. Až bude správně dochucená,
          naservírujeme ji.
        </span>
      </div>

      <style>{`
        @keyframes steam {
          0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.6; }
          50% { transform: translateY(-6px) scaleY(1.15); opacity: 1; }
        }
        @keyframes drop {
          0% { transform: translate(-50%, -8px); opacity: 0; }
          20% { opacity: 1; }
          70% { transform: translate(-50%, 14px); opacity: 1; }
          85% { transform: translate(-50%, 16px); opacity: 0; }
          100% { transform: translate(-50%, 16px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes steam { from, to { transform: none; opacity: 0.6; } }
          @keyframes drop { from, to { transform: translate(-50%, 0); opacity: 0; } }
        }
      `}</style>
    </div>
  )
}
