"use client";

import { Button } from "@/components/ui/button";
import { ONBOARDING_TEXT } from "@/lib/constants/onboarding";
import { CheckCircle2 } from "lucide-react";

interface WelcomeStepProps {
  onContinue: () => void;
}

/**
 * Welcome step for first-time users
 * Explains the onboarding process before starting
 */
export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  const { title, subtitle, description, steps, timeEstimate, button } =
    ONBOARDING_TEXT.welcome;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Steps explanation */}
      <div className="space-y-4">
        <p className="text-sm font-medium">{description}</p>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {index + 1}
              </div>
              <p className="text-sm leading-6">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Time estimate */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span>{timeEstimate}</span>
        </div>
      </div>

      {/* Continue button */}
      <Button onClick={onContinue} className="w-full" size="lg">
        {button}
      </Button>
    </div>
  );
}
