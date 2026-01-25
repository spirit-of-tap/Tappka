import { VerifyForm } from "@/components/verify-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function VerifyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must be logged in to access verification
  if (!user) {
    redirect("/");
  }

  // Check if already verified
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_verified, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.is_verified) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex justify-between items-center p-4">
        <div className="text-sm text-muted-foreground">
          Přihlášeno jako: <span className="font-medium">{profile?.full_name || user.email}</span>
        </div>
        <div className="flex gap-2">
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header text */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-heading font-bold">
              Ověření školního e-mailu
            </h1>
            <p className="text-muted-foreground">
              Pro přístup do systému musíme ověřit váš školní e-mail
            </p>
          </div>

          {/* Verify Form */}
          <VerifyForm />
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        <p>Tiimiakatemia Prague {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
