import { redirect } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import {
  getUserBookPointsStats,
  getUnreadTeamEssaysForCoach,
  getTeamBookPointsStats,
} from "@/lib/essays/queries";
import { countCustomerMeetings } from "@/lib/customer-meetings/queries";
import { resolveDashboardWidgets, type DashboardWidgetId } from "@/lib/dashboard/types";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";
import { listViewerSessions } from "@/lib/training-sessions/queries";
import { FirstLoginConfetti } from "@/components/first-login-confetti";
import { NextTrainingSessionCard, type DashboardTrainingSession } from "@/components/dashboard/next-training-session-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ReadingProgressCard } from "@/components/dashboard/reading-progress-card";
import {
  NextReservationCard,
  type DashboardReservation,
} from "@/components/dashboard/next-reservation-card";
import { CoachReviewCard } from "@/components/dashboard/coach-review-card";
import { TeamSnapshotCard } from "@/components/dashboard/team-snapshot-card";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { MessageCircleQuestion, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const TEAMS_SUPPORT_URL =
  "https://teams.microsoft.com/l/channel/19%3Aea499f40a2864e03862e5b517fa824a8%40thread.tacv2/HelpDesk%20IT%20House?groupId=c84b63de-1603-4ba8-98a6-9825300c0f22&tenantId=f26a48e1-fc21-461a-b97f-ac5bd535f341";

const RESERVATION_PREVIEW_COUNT = 3;

const EMPTY_STATS = { approved_points: 0, pending_points: 0, essay_count: 0, approved_points_this_semester: 0 };

async function getUpcomingReservations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
): Promise<{ upcoming: DashboardReservation[]; count: number }> {
  const { data, count } = await supabase
    .from("reservations")
    .select("id, title, start_at, end_at, room:rooms(id, code, name)", { count: "exact" })
    .eq("owner_profile_id", profileId)
    .is("cancelled_at", null)
    .gt("end_at", new Date().toISOString())
    .order("start_at")
    .limit(RESERVATION_PREVIEW_COUNT);

  return { upcoming: (data ?? []) as DashboardReservation[], count: count ?? 0 };
}

/** Widgets in the narrow side panel; every other card-like widget goes in the main panel. */
const SIDE_WIDGETS: ReadonlySet<DashboardWidgetId> = new Set(["reading", "team-snapshot", "metrics"]);

const PANEL = "flex min-w-0 flex-col rounded-3xl border bg-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  const isCoach = profile.role === "coach" || profile.role === "admin";
  const firstName = profile.name ? profile.name.split(" ")[0] : "";

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
  const layout = resolveDashboardWidgets(layoutRow?.widgets, profile.role, hasMetricsAccess);

  const has = (id: DashboardWidgetId) => layout.includes(id);
  // The header shows these counts whatever widgets are on.
  const needsUnread = isCoach && !!profile.team_id;

  // Only fetch data for widgets the user shows.
  const needsStats = !isCoach || has("metrics");
  const [stats, reservations, unreadEssays, teamStats, meetingCount, viewerSessions] = await Promise.all([
    needsStats
      ? getUserBookPointsStats(supabase, profile.id).catch(() => EMPTY_STATS)
      : null,
    getUpcomingReservations(supabase, profile.id).catch(() => ({ upcoming: [], count: 0 })),
    needsUnread
      ? getUnreadTeamEssaysForCoach(supabase, profile.id, profile.team_id!).catch(
          () => [],
        )
      : [],
    has("team-snapshot") && profile.team_id
      ? getTeamBookPointsStats(supabase, profile.team_id).catch(() => [])
      : [],
    has("metrics") ? countCustomerMeetings(supabase, profile.id).catch(() => 0) : 0,
    has("next-session")
      ? listViewerSessions(
          supabase,
          { profileId: profile.id, teamId: profile.team_id },
          { from: new Date().toISOString(), order: "asc", limit: 10 },
        ).catch(() => [])
      : [],
  ]);

  const nextSession = viewerSessions.find((session) => !session.cancelled_at) ?? null;
  const nextSessionData: DashboardTrainingSession | null = nextSession
    ? {
        id: nextSession.id,
        topic: nextSession.topic,
        starts_at: nextSession.starts_at,
        ends_at: nextSession.ends_at,
        location: nextSession.room?.code ?? nextSession.location_note,
        team: nextSession.team
          ? { name: nextSession.team.name, color: nextSession.team.color }
          : null,
        facilitators: nextSession.facilitators,
        isCross: nextSession.guests.some((guest) => guest.profile_id === profile.id),
      }
    : null;

  const nodes: Partial<Record<DashboardWidgetId, ReactNode>> = {};
  if (has("quick-actions")) {
    nodes["quick-actions"] = (
      <QuickActions isCoach={isCoach} unreadCount={unreadEssays.length} />
    );
  }
  if (has("next-session")) {
    nodes["next-session"] = <NextTrainingSessionCard session={nextSessionData} />;
  }
  if (has("reading") && stats) {
    nodes["reading"] = (
      <ReadingProgressCard stats={stats} onboardingYear={profile.team?.onboardingYear} />
    );
  }
  if (has("reservation")) {
    nodes["reservation"] = <NextReservationCard reservations={reservations.upcoming} total={reservations.count} />;
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
        teamId={profile.team_id}
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

  const placed = layout.filter((id) => id !== "quick-actions" && nodes[id]);
  const mainWidgets = placed.filter((id) => !SIDE_WIDGETS.has(id));
  const sideWidgets = placed.filter((id) => SIDE_WIDGETS.has(id));

  return (
    <>
      <FirstLoginConfetti />

      <DashboardHero
        firstName={firstName}
        now={new Date()}
        bookPoints={isCoach || !stats ? null : stats.approved_points}
        upcomingReservations={reservations.count}
        unreadEssays={isCoach && profile.team_id ? unreadEssays.length : null}
      >
        {nodes["quick-actions"]}
      </DashboardHero>

      {(mainWidgets.length > 0 || sideWidgets.length > 0) && (
        <div
          className={cn(
            "grid items-start gap-4",
            mainWidgets.length > 0 && sideWidgets.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]",
          )}
        >
          {mainWidgets.length > 0 && (
            <div className={PANEL}>
              {mainWidgets.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && <div aria-hidden className="mx-6 h-px bg-border" />}
                  {nodes[id]}
                </Fragment>
              ))}
            </div>
          )}
          {sideWidgets.length > 0 && (
            <div className={PANEL}>
              {sideWidgets.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && <div aria-hidden className="mx-6 h-px bg-border" />}
                  {nodes[id]}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}

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
