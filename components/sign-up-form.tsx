"use client";

import { cn } from "@/lib/utils";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (!fullName.trim()) {
      setError("Zadejte sve jmeno");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Heslo musi mit alespon 6 znaku");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/verify`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          throw new Error("Tento e-mail je jiz registrovan");
        }
        throw error;
      }

      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Registrace se nezdarila"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Registrace</CardTitle>
          <CardDescription>
            Vytvorte si ucet. Tym a role budou prirazeny po overeni skolniho
            e-mailu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-4">
              {/* Full Name */}
              <div className="grid gap-2">
                <Label htmlFor="fullName">Cele jmeno</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jan Novak"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vas@email.cz"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Pouzijte svuj osobni e-mail (Gmail, Seznam, atd.)
                </p>
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimalne 6 znaku"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Error */}
              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Registruji..." : "Zaregistrovat se"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm">
              Uz mas ucet?{" "}
              <Link href="/" className="underline underline-offset-4">
                Prihlasit se
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
