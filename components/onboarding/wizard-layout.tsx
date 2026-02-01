"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WizardProgress } from "./wizard-progress";
import { cn } from "@/lib/utils";

interface WizardLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  showProgress?: boolean;
  className?: string;
}

/**
 * Shared layout wrapper for wizard steps
 * Provides consistent styling and progress indication
 */
export function WizardLayout({
  children,
  currentStep,
  totalSteps,
  showProgress = true,
  className,
}: WizardLayoutProps) {
  return (
    <div className="w-full max-w-md">
      <Card className={cn("", className)}>
        {showProgress && (
          <CardHeader className="space-y-4 pb-4">
            <WizardProgress currentStep={currentStep} totalSteps={totalSteps} />
          </CardHeader>
        )}
        <CardContent className={showProgress ? "pt-0" : ""}>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
