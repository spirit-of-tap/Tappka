import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Users, Shield } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  team_leader: "Team Leader",
  coach: "Kouc",
  admin: "Admin",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Get profile with team info
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      *,
      teams (
        id,
        name,
        year
      )
    `
    )
    .eq("id", user.id)
    .single();

  // Redirect unverified users to verify page
  if (!profile?.is_verified) {
    redirect("/verify");
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-heading font-bold text-primary">
              Tappka
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile.full_name}
            </span>
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-heading font-bold">
            Vitej, {profile.full_name?.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Toto je tvuj dashboard v Tappka.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Profile card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profil</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile.full_name}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.school_email || user.email}
              </p>
            </CardContent>
          </Card>

          {/* Role card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Role</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {ROLE_LABELS[profile.role] || profile.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {profile.is_verified ? "Overeny ucet" : "Neovereny ucet"}
              </p>
            </CardContent>
          </Card>

          {/* Team card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tym</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {profile.teams ? (
                <>
                  <div className="text-2xl font-bold">{profile.teams.name}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.teams.year}. rocnik
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">
                    -
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bez tymu
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Placeholder content */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Dalsi funkce</CardTitle>
              <CardDescription>
                Tady budou dalsi funkce aplikace...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Rezervace mistnosti, eseje, schuzky a dalsi funkce budou brzy k
                dispozici.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Tiimiakatemia Prague {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}
