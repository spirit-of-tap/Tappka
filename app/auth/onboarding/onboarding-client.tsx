"use client";

import { useState } from "react";
import { WizardLayout } from "@/components/onboarding/wizard-layout";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { VerifyEmailForm } from "@/components/verify-email-form";
import { LogoutButton } from "@/components/logout-button";
import { EmailVerificationRealtimeListener } from "@/components/email-verification-realtime-listener";
import { ProfileLinkRealtimeListener } from "@/components/profile-link-realtime-listener";

interface OnboardingClientProps {
  next?: string;
}

/**
 * Client-side onboarding wizard
 * Guides first-time users through the verification process
 */
export function OnboardingClient({ next }: OnboardingClientProps) {
  const [currentScreen, setCurrentScreen] = useState<"welcome" | "verify">("welcome");
  const [verifyStep, setVerifyStep] = useState<"email" | "otp">("email");

  // Calculate current step number for progress bar
  // Welcome = 0, Email = 1, OTP = 2
  const getCurrentStep = () => {
    if (currentScreen === "welcome") return 0;
    if (verifyStep === "email") return 1;
    return 2;
  };

  const totalSteps = 2; // Email verification + OTP verification

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative">
      {/* Realtime listeners for email verification and profile linking */}
      <EmailVerificationRealtimeListener />
      <ProfileLinkRealtimeListener />
      
      {/* Logout button */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LogoutButton />
      </div>

      {/* Wizard content */}
      {currentScreen === "welcome" ? (
        <WizardLayout
          currentStep={0}
          totalSteps={totalSteps}
          showProgress={false}
        >
          <WelcomeStep onContinue={() => setCurrentScreen("verify")} />
        </WizardLayout>
      ) : (
        <WizardLayout
          currentStep={getCurrentStep()}
          totalSteps={totalSteps}
          showProgress={true}
        >
          <div className="space-y-4">
            {/* Step indicator */}
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {verifyStep === "email"
                  ? "Ověření ČZU emailu"
                  : "Potvrď svůj email"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {verifyStep === "email"
                  ? "Zadej svůj ČZU email, na který ti pošleme ověřovací email."
                  : "Klikni na tlačítko v emailu. Alternativně můžeš zadat ověřovací kód."}
              </p>
            </div>

            {/* Email verification form */}
            <VerifyEmailForm
              next={next}
              wizardMode={true}
              onStepChange={setVerifyStep}
            />
          </div>
        </WizardLayout>
      )}
    </div>
  );
}
