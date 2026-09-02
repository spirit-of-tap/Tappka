import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import {
  getUserBookPointsStats,
  getUnreadTeamEssaysForCoach,
  getTeamBookPointsStats,
} from "@/lib/essays/queries";
import { countCustomerMeetings } from "@/lib/customer-meetings/queries";
import {
  sanitizeWidgetIds,
  widgetsForRole,
  availableWidgetIds,
  availableWidgets,
  type DashboardWidgetId,
} from "@/lib/dashboard/types";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";
import { FirstLoginConfetti } from "@/components/first-login-confetti";
import { DashboardEditor } from "@/components/dashboard/dashboard-editor";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ReadingProgressCard } from "@/components/dashboard/reading-progress-card";
import {
  NextReservationCard,
  type DashboardReservation,
} from "@/components/dashboard/next-reservation-card";
import { CoachReviewCard } from "@/components/dashboard/coach-review-card";
import { TeamSnapshotCard } from "@/components/dashboard/team-snapshot-card";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { MessageCircleQuestion, ExternalLink } from "lucide-react";

const TEAMS_SUPPORT_URL =
  "https://teams.microsoft.com/l/channel/19%3Aea499f40a2864e03862e5b517fa824a8%40thread.tacv2/HelpDesk%20IT%20House?groupId=c84b63de-1603-4ba8-98a6-9825300c0f22&tenantId=f26a48e1-fc21-461a-b97f-ac5bd535f341";

const EMPTY_STATS = { approved_points: 0, pending_points: 0, essay_count: 0, approved_points_this_semester: 0 };

async function getNextReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
): Promise<DashboardReservation | null> {
  const { data } = await supabase
    .from("reservations")
    .select("id, title, start_at, end_at, room:rooms(id, code, name)")
    .eq("owner_profile_id", profileId)
    .is("cancelled_at", null)
    .gt("end_at", new Date().toISOString())
    .order("start_at")
    .limit(1)
    .maybeSingle();

  return (data as DashboardReservation | null) ?? null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  const isCoach = profile.role === "coach" || profile.role === "admin";
  const firstName = profile.name ? profile.name.split(" ")[0] : "";
  const today = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { data: layoutRow } = await supabase
    .from("dashboard_layouts")
    .select("widgets")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const accessProfile = {
    role: profile.role,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
  };
  const hasMetricsAccess = canAccessFeature(accessProfile, "dashboardMetrics");
  const layout = availableWidgetIds(
    sanitizeWidgetIds(layoutRow?.widgets, profile.role),
    hasMetricsAccess,
  );

  const has = (id: DashboardWidgetId) => layout.includes(id);
  const needsUnread =
    isCoach && !!profile.team_id && (has("ke-kontrole") || has("quick-actions"));

  // Only fetch data for widgets the user actually placed on the dashboard.
  const needsStats = has("reading") || has("metrics");
  const [stats, reservation, unreadEssays, teamStats, meetingCount] = await Promise.all([
    needsStats
      ? getUserBookPointsStats(supabase, profile.id).catch(() => EMPTY_STATS)
      : null,
    has("reservation") ? getNextReservation(supabase, profile.id) : null,
    needsUnread
      ? getUnreadTeamEssaysForCoach(supabase, profile.id, profile.team_id!).catch(
          () => [],
        )
      : [],
    has("team-snapshot") && profile.team_id
      ? getTeamBookPointsStats(supabase, profile.team_id).catch(() => [])
      : [],
    has("metrics") ? countCustomerMeetings(supabase, profile.id).catch(() => 0) : 0,
  ]);

  const nodes: Partial<Record<DashboardWidgetId, ReactNode>> = {};
  if (has("quick-actions")) {
    nodes["quick-actions"] = (
      <QuickActions isCoach={isCoach} unreadCount={unreadEssays.length} />
    );
  }
  if (has("reading") && stats) {
    nodes["reading"] = <ReadingProgressCard stats={stats} />;
  }
  if (has("reservation")) {
    nodes["reservation"] = <NextReservationCard reservation={reservation} />;
  }
  if (has("ke-kontrole")) {
    nodes["ke-kontrole"] = (
      <CoachReviewCard essays={unreadEssays} hasTeam={!!profile.team_id} />
    );
  }
  if (has("team-snapshot")) {
    nodes["team-snapshot"] = (
      <TeamSnapshotCard
        stats={teamStats}
        hasTeam={!!profile.team_id}
        teamName={profile.team?.name}
      />
    );
  }
  if (has("metrics") && hasMetricsAccess && stats) {
    nodes["metrics"] = (
      <MetricsCard
        bookPoints={stats.approved_points}
        meetingCount={meetingCount}
      />
    );
  }

  return (
    <>
      <FirstLoginConfetti />

      {/* Hero greeting */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {firstName ? `Vítej, ${firstName}!` : "Vítej!"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm first-letter:uppercase">
          {today}
        </p>
      </div>

      <DashboardEditor
        initialLayout={layout}
        catalog={availableWidgets(widgetsForRole(profile.role), hasMetricsAccess)}
        nodes={nodes}
      />

      {/* Support */}
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <MessageCircleQuestion className="size-4 shrink-0" />
        <span>Potřebuješ pomoc?</span>
        <a
          href={TEAMS_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline underline-offset-4"
        >
          IT HelpDesk
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </>
  );
}
