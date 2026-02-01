import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DeveloperLinks } from "@/components/developer-links";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";
import { headers } from "next/headers";

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
      {/* Header with theme toggle */}
      <header className="absolute top-0 right-0 p-4">
        <ThemeSwitcher />
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Tappka Logo/Branding */}
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-heading font-bold text-primary tracking-tight">
              Tappka
            </h1>
            <p className="text-muted-foreground text-sm">
              Pro Téčka a kouče Tiimiakatemia Prague
            </p>
          </div>

          {/* Conditional content based on login status */}
          {isLoggedIn ? (
            <div className="flex flex-col gap-4">
              <Button asChild className="w-full" size="lg">
                <Link href={DEFAULT_LOGGED_IN_PAGE}>
                  přejít do Tappky
                </Link>
              </Button>
            </div>
          ) : (
            <LoginForm next={validatedNext} />
          )}

          {/* Developer Tools */}
          <DeveloperLinks />
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        <p>Tiimiakatemia Prague {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
