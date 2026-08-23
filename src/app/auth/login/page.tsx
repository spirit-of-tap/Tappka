import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";
import { headers } from "next/headers";
import { Sparkles } from "lucide-react";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Přihlášení",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function Home({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Validate next parameter to prevent open redirects
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const validatedNext = next ? validateRedirectUrl(next, origin) : undefined;

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Header with theme toggle & about link */}
      <header className="absolute top-0 right-0 p-4 md:p-6 flex items-center gap-3 z-10">
        <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm font-medium">
          <Link href="/about">
            O aplikaci
          </Link>
        </Button>
        <ThemeSwitcher />
      </header>

      {/* PEF logo */}
      <div className="absolute top-0 left-0 p-4 md:p-6">
        <Image
          src="/pef_logo/CZU_PEF_cerna_RGB.png"
          alt="ČZU PEF"
          width={140}
          height={40}
          className="object-contain dark:hidden"
          priority
        />
        <Image
          src="/pef_logo/CZU_PEF_bila_RGB.png"
          alt="ČZU PEF"
          width={140}
          height={40}
          className="hidden object-contain dark:block"
          priority
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Tappka Logo/Branding */}
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-2">
              <Image
                src="/tap_logo.png"
                alt="TAP Logo"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-5xl font-heading font-bold text-primary tracking-tight">
              Tappka
            </h1>
            <p className="text-muted-foreground">
              Pro Téčka a kouče:ky Tiimiakatemia Prague
            </p>
          </div>

          {/* Conditional content based on login status */}
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-heading text-xl font-semibold">Už jsi přihlášený:á!</h2>
                  <p className="text-sm text-muted-foreground">
                    Pokračuj do aplikace
                  </p>
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href={DEFAULT_LOGGED_IN_PAGE}>
                    Přejít do Tappky
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <LoginForm next={validatedNext ?? undefined} />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 md:p-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link
            href="/about"
            className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            O aplikaci
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          © Tiimiakatemia Prague {new Date().getFullYear()}
        </p>
        <p className="text-xs text-muted-foreground">
          Vlastnictví: Spirit of TAP | Vývoj: IT House | Financováno z komunitní kasy
        </p>
      </footer>
    </main>
  );
}
