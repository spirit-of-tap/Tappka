"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

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
        throw new Error(data.error || "Odeslani kodu se nezdarilo");
      }

      setStep("code");
      startCooldown();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Odeslani kodu se nezdarilo"
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
        throw new Error(data.error || "Overeni se nezdarilo");
      }

      // Refresh auth state and redirect to dashboard
      const supabase = createClient();
      await supabase.auth.refreshSession();
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Overeni se nezdarilo"
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
        throw new Error(data.error || "Odeslani kodu se nezdarilo");
      }

      startCooldown();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Odeslani kodu se nezdarilo"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          {step === "code" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep("email")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              {step === "email" ? (
                <>
                  <Mail className="h-5 w-5" />
                  Zadejte skolni e-mail
                </>
              ) : (
                <>
                  <KeyRound className="h-5 w-5" />
                  Zadejte overovaci kod
                </>
              )}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Zadejte svuj skolni e-mail (@pef.czu.cz nebo @studenti.czu.cz)"
                : `Poslali jsme 6-mistny kod na ${schoolEmail}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="schoolEmail">Skolni e-mail</Label>
                <Input
                  id="schoolEmail"
                  type="email"
                  placeholder="jan.novak@studenti.czu.cz"
                  required
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Odesilam..." : "Odeslat overovaci kod"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Overovaci kod</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
                {isLoading ? "Overuji..." : "Overit"}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Neprisel kod? </span>
                {cooldown > 0 ? (
                  <span className="text-muted-foreground">
                    Poslat znovu za {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="underline underline-offset-4 hover:text-primary"
                    disabled={isLoading}
                  >
                    Poslat znovu
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
