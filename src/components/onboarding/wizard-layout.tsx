"use client";

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
    <div className={cn("w-full max-w-md", className)}>
      {showProgress && (
        <div className="space-y-4 mb-6">
          <WizardProgress currentStep={currentStep} totalSteps={totalSteps} />
        </div>
      )}
      <div>
        {children}
      </div>
    </div>
  );
}
