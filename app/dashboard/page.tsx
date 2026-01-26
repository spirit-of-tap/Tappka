import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  coach: "Kouč",
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
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-heading font-bold">
          Vítej, {profile.full_name?.split(" ")[0]}!
        </h2>
        <p className="text-muted-foreground mt-1">
          Toto je tvůj dashboard v Tappka.
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
              {profile.is_verified ? "Ověřený účet" : "Neověřený účet"}
            </p>
          </CardContent>
        </Card>

        {/* Team card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tým</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {profile.teams ? (
              <>
                <div className="text-2xl font-bold">{profile.teams.name}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.teams.year}. ročník
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">
                  -
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bez týmu
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
            <CardTitle>Další funkce</CardTitle>
            <CardDescription>
              Tady budou další funkce aplikace...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Rezervace místnosti, eseje, schůzky a další funkce budou brzy k
              dispozici.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
