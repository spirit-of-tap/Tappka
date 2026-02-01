import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

/**
 * Wizard progress bar component
 * Shows visual progress through onboarding steps
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  className,
}: WizardProgressProps) {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Krok {currentStep} z {totalSteps}
        </span>
        <span>{Math.round(progressPercentage)}%</span>
      </div>
      <Progress value={progressPercentage} className="h-2" />
    </div>
  );
}
