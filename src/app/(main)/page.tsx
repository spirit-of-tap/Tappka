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
import { resolveDashboardWidgets, type DashboardWidgetId } from "@/lib/dashboard/types";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";
import { listViewerSessions } from "@/lib/training-sessions/queries";
import { FirstLoginConfetti } from "@/components/first-login-confetti";
import { NextTrainingSessionCard, type DashboardTrainingSession } from "@/components/dashboard/next-training-session-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ProgressRotator } from "@/components/dashboard/progress-rotator";
import { RoomsWeekCard } from "@/components/dashboard/rooms-week-card";
import { CoachReviewCard } from "@/components/dashboard/coach-review-card";
import { TeamSnapshotCard } from "@/components/dashboard/team-snapshot-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { MessageCircleQuestion, ExternalLink } from "lucide-react";
import { buildRoomsWeek, type WeekReservationInput } from "@/lib/dashboard/rooms-week";
import { bookPointsSlide, customerMeetingsSlide, type ProgressSlide } from "@/lib/dashboard/progress-slides";
import { currentStudySemester } from "@/lib/metrics/semester-milestone";
import { greetingName } from "@/lib/profile/greeting-name";
import { cn } from "@/lib/utils";

const TEAMS_SUPPORT_URL =
  "https://teams.microsoft.com/l/channel/19%3Aea499f40a2864e03862e5b517fa824a8%40thread.tacv2/HelpDesk%20IT%20House?groupId=c84b63de-1603-4ba8-98a6-9825300c0f22&tenantId=f26a48e1-fc21-461a-b97f-ac5bd535f341";

const CARD_STAGGER_MS = 70;
const CARD_STAGGER_BASE_MS = 80;

const EMPTY_STATS = { approved_points: 0, pending_points: 0, essay_count: 0, approved_points_this_semester: 0 };

/** Nearest upcoming reservations (enough to fill the week strip) and the count of all of them. */
async function getUpcomingReservations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  now: Date,
): Promise<{ upcoming: WeekReservationInput[]; count: number }> {
  const { data, count } = await supabase
    .from("reservations")
    .select("id, title, start_at, end_at, room:rooms(id, code, name)", { count: "exact" })
    .eq("owner_profile_id", profileId)
    .is("cancelled_at", null)
    .gt("end_at", now.toISOString())
    .order("start_at")
    .limit(30);

  return { upcoming: (data ?? []) as WeekReservationInput[], count: count ?? 0 };
}

/**
 * Cards in render order. The first two share the top row 7/5 on wide screens,
 * the rest split the next row evenly.
 */
const CARD_ORDER: DashboardWidgetId[] = ["next-session", "ke-kontrole", "reading", "reservation", "team-snapshot"];
const ROW_SPAN: Record<number, string> = { 1: "xl:col-span-12", 2: "xl:col-span-6", 3: "xl:col-span-4" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  const isCoach = profile.role === "coach" || profile.role === "admin";
  const firstName = greetingName(profile);

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
  const showProgress = has("reading") || has("metrics");
  const showMeetings = showProgress && canAccessFeature(accessProfile, "customerMeetings");
  const now = new Date();
  const [stats, reservations, unreadEssays, teamStats, meetingCount, viewerSessions] = await Promise.all([
    needsStats
      ? getUserBookPointsStats(supabase, profile.id).catch(() => EMPTY_STATS)
      : null,
    getUpcomingReservations(supabase, profile.id, now).catch(() => ({ upcoming: [], count: 0 })),
    needsUnread
      ? getUnreadTeamEssaysForCoach(supabase, profile.id, profile.team_id!).catch(
          () => [],
        )
      : [],
    has("team-snapshot") && profile.team_id
      ? getTeamBookPointsStats(supabase, profile.team_id).catch(() => [])
      : [],
    showMeetings ? countCustomerMeetings(supabase, profile.id).catch(() => 0) : 0,
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
  if (has("next-session")) {
    nodes["next-session"] = <NextTrainingSessionCard session={nextSessionData} now={now} />;
  }
  if (has("ke-kontrole")) {
    nodes["ke-kontrole"] = <CoachReviewCard essays={unreadEssays} hasTeam={!!profile.team_id} />;
  }
  if (showProgress && stats) {
    const semester = currentStudySemester(now, profile.team?.onboardingYear);
    const slides: ProgressSlide[] = [bookPointsSlide(stats, semester)];
    if (showMeetings) slides.push(customerMeetingsSlide(meetingCount, semester));
    nodes["reading"] = <ProgressRotator slides={slides} />;
  }
  if (has("reservation")) {
    const week = buildRoomsWeek(reservations.upcoming, now);
    nodes["reservation"] = <RoomsWeekCard days={week.days} items={week.items} total={reservations.count} />;
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

  const cards = CARD_ORDER.filter((id) => nodes[id]);
  const topRow = cards.slice(0, 2);
  const rest = cards.slice(2);
  const spanOf = (index: number): string => {
    if (index < 2) return topRow.length === 1 ? "xl:col-span-12" : index === 0 ? "xl:col-span-7" : "xl:col-span-5";
    return ROW_SPAN[rest.length] ?? "xl:col-span-4";
  };

  return (
    <>
      <FirstLoginConfetti />

      <div className="flex flex-col gap-5">
        <DashboardHero firstName={firstName} now={now}>
          {has("quick-actions") && <QuickActions isCoach={isCoach} unreadCount={unreadEssays.length} />}
        </DashboardHero>

        {cards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            {cards.map((id, i) => (
              <div
                key={id}
                style={{ animationDelay: `${CARD_STAGGER_BASE_MS + i * CARD_STAGGER_MS}ms` }}
                className={cn("min-w-0 motion-safe:animate-rise", i === 0 && "md:col-span-2", spanOf(i))}
              >
                {nodes[id]}
              </div>
            ))}
          </div>
        )}
      </div>

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
