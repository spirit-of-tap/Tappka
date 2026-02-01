import { LoginForm } from "@/components/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DeveloperLinks } from "@/components/developer-links";

export default async function Home() {

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

          {/* Login Form */}
          <LoginForm />

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
