import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
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

  // Get profile with team info
  const profile = await getCurrentUserProfile(supabase)



  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-heading font-bold">
          Vítej, {profile?.name?.split(" ")[0]}!
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
            <div className="text-2xl font-bold">{profile?.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {profile?.work_email || user?.email || ""}
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
                {ROLE_LABELS[profile?.role || ""] || profile?.role}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {profile?.role ? "Ověřený účet" : "Neověřený účet"}
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
            {profile?.team_id ? (
              <>
                <div className="text-2xl font-bold">{profile?.team?.name}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile?.team?.year}. ročník
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
