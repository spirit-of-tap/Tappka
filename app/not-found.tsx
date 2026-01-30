import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SearchX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Header with theme toggle */}
      <header className="absolute top-0 right-0 p-4">
        <ThemeSwitcher />
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center space-y-8">
          {/* Giant 404 with icon */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <SearchX 
                className="w-24 h-24 text-primary/20" 
                strokeWidth={1.5} 
              />
            </div>
            <h1 className="text-8xl md:text-9xl font-heading font-bold text-primary tracking-tight">
              404
            </h1>
          </div>

          {/* Funny message */}
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Oh noo, asi jsi tappnul vedle...
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto">
              Tady nic není. Stránka neexistuje nebo se ztratila někde v TAPu.
            </p>
          </div>

          {/* Back button with arrow */}
          <div className="pt-4">
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
                Zpět domů
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        <p>Tiimiakatemia Prague {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
