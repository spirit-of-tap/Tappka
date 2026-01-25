"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = "email" | "code";

export function VerifyForm() {
  const [step, setStep] = useState<Step>("email");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();

  // Cooldown timer for resend
  const startCooldown = () => {
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/verify/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_email: schoolEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Odeslání kódu se nezdařilo");
      }

      setStep("code");
      startCooldown();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Odeslání kódu se nezdařilo"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/verify/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_email: schoolEmail, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ověření se nezdařilo");
      }

      // Refresh auth state and redirect to dashboard
      const supabase = createClient();
      await supabase.auth.refreshSession();
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Ověření se nezdařilo"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/verify/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_email: schoolEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Odeslání kódu se nezdařilo");
      }

      startCooldown();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Odeslání kódu se nezdařilo"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          step === "email" 
            ? "bg-primary text-primary-foreground" 
            : "bg-primary/20 text-primary"
        }`}>
          1
        </div>
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div className={`h-full bg-primary transition-all duration-500 ${
            step === "code" ? "w-full" : "w-0"
          }`} />
        </div>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          step === "code" 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted text-muted-foreground"
        }`}>
          2
        </div>
      </div>

      {/* Form header */}
      <div className="space-y-2">
        {step === "email" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-heading font-bold">Zadej školní e-mail</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Zadej svůj školní e-mail (@pef.czu.cz nebo @studenti.czu.cz)
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <h2 className="text-xl font-heading font-bold">Zadej ověřovací kód</h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Poslali jsme 6-místný kód na <span className="font-medium text-foreground">{schoolEmail}</span>
            </p>
          </>
        )}
      </div>

      {/* Forms */}
      {step === "email" ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="schoolEmail" className="text-sm font-medium">
              Školní e-mail
            </Label>
            <Input
              id="schoolEmail"
              type="email"
              placeholder="jan.novak@studenti.czu.cz"
              required
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium"
            disabled={isLoading}
          >
            {isLoading ? "Odesílám..." : "Odeslat ověřovací kód"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Ověřovací kód
            </Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
                containerClassName="gap-2"
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                  <InputOTPSlot index={3} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-xl font-semibold rounded-lg border-2" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? "Ověřuji..." : "Ověřit kód"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Nepřišel kód? </span>
            {cooldown > 0 ? (
              <span className="text-muted-foreground">
                Poslat znovu za {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                className="text-primary hover:underline underline-offset-4 font-medium"
                disabled={isLoading}
              >
                Poslat znovu
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
