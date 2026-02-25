import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { FirstLoginConfetti } from "@/components/first-login-confetti";
import {
  User,
  Users,
  Mail,
  Shield,
  Sparkles,
  MessageCircleQuestion,
  ExternalLink,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  team_leader: "Team Leader",
  coach: "Kouč",
  admin: "Admin",
};

const TEAMS_SUPPORT_URL =
  "https://teams.microsoft.com/l/channel/19%3Aea499f40a2864e03862e5b517fa824a8%40thread.tacv2/HelpDesk%20IT%20House?groupId=c84b63de-1603-4ba8-98a6-9825300c0f22&tenantId=f26a48e1-fc21-461a-b97f-ac5bd535f341";

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase, { includeTeam: true });

  const firstName = profile?.name?.split(" ")[0];

  return (
    <>
      <FirstLoginConfetti />

      {/* Hero greeting */}
      <div className="mb-10">
        <h2 className="text-3xl font-heading font-bold tracking-tight">
          Vítej, {firstName}!
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Toto je tvůj přehled v Tappka.
        </p>
      </div>

      {/* Profile section */}
      <div className="max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Tvůj profil
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium leading-none">{profile?.name}</p>
              </div>
            </div>

            {profile?.role && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </p>
              </div>
            )}

            {profile?.work_email && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{profile.work_email}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {profile?.team
                  ? `${profile.team.name} · ${profile.team.year}. ročník`
                  : "Bez týmu"}
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Coming soon */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground pt-1.5">
            Do Tappky postupně přibývají další funkce — rezervace místností už
            fungují, brzy přibudou eseje, schůzky a další.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Support */}
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
            <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="pt-1">
            <p className="text-sm font-medium leading-none mb-1">Potřebuješ pomoc?</p>
            <p className="text-sm text-muted-foreground mb-2">
              Napiš nám na IT HelpDesk v Microsoft Teams.
            </p>
            <a
              href={TEAMS_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              Otevřít HelpDesk
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
