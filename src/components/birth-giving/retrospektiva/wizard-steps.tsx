"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface BirthGivingWizardStepsProps {
  steps: readonly string[];
  currentIndex: number;
  onStepClick: (index: number) => void;
}

export function BirthGivingWizardSteps({
  steps,
  currentIndex,
  onStepClick,
}: BirthGivingWizardStepsProps) {
  return (
    <ol aria-label="Kroky retrospektivy" className="flex flex-wrap items-center gap-1 text-sm">
      {steps.map((label, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={label}>
            <button
              type="button"
              disabled={!isDone}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onStepClick(index)}
              className={cn(
                "focus-ring -mx-1.5 -my-0.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
                isCurrent && "font-semibold text-foreground",
                !isCurrent && !isDone && "text-muted-foreground",
                isDone && "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                !isDone && "cursor-default",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="size-3.5 text-success-strong" />
              ) : (
                <span className="font-medium text-muted-foreground">{index + 1}.</span>
              )}
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
