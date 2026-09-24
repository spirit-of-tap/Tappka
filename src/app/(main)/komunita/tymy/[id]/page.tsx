import { notFound } from 'next/navigation';
import { Building2, ChartColumn, ExternalLink, Globe, Instagram, Linkedin, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  getFormerTeamMembers,
  getTeamById,
  getTeamPictureUrl,
  getTeamGroupPictureUrl,
  getProfilePictureUrl,
} from '@/lib/komunita/queries';
import { getSessionProfile } from '@/lib/auth/session';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCard } from '@/components/komunita/user-card';
import { TeamMemberAdminActions } from '@/components/komunita/team-member-admin-actions';
import { PageBack } from '@/components/ui/page-back';
import { PageShell } from '@/components/ui/page-shell';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import { TeamCustomerMeetingsChart } from '@/components/teams/team-customer-meetings-chart';
import { TeamCoachingSessionsChart } from '@/components/teams/team-coaching-sessions-chart';
import { TeamEditDialog } from '@/components/teams/team-edit-dialog';
import { YEAR_LABELS, ROLE_LABELS } from '@/lib/komunita/types';
import { getTeamBookPointsStats } from '@/lib/essays/queries';
import { getTeamCustomerMeetingsStats } from '@/lib/customer-meetings/queries';
import { getTeamCoachingSessionStats } from '@/lib/individual-coaching-sessions/queries';
import {
  cleanIco,
  displayDomain,
  displayInstagram,
  formatInstagramUrl,
  formatUrl,
  getPublicRegistryUrl,
} from '@/lib/teams/links';

export const metadata = {
  title: 'Tým',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [team, bookStats, meetingStats, coachingStats, formerMembers, sessionProfile] = await Promise.all([
    getTeamById(supabase, id),
    getTeamBookPointsStats(supabase, id).catch(() => []),
    getTeamCustomerMeetingsStats(id).catch(() => []),
    getTeamCoachingSessionStats(id).catch(() => []),
    getFormerTeamMembers(supabase, id).catch(() => []),
    getSessionProfile().catch(() => null),
  ]);

  if (!team) {
    notFound();
  }

  const isAdmin = sessionProfile?.role === 'admin';
  const isTeamMember = sessionProfile?.team_id === team.id;
  const canEdit = isTeamMember || isAdmin;

  const teamPictureUrl = getTeamPictureUrl(supabase, team);
  const teamGroupPictureUrl = getTeamGroupPictureUrl(supabase, team);
  const teamColor = team.color ?? null;

  // Group profiles by role
  const coaches = team.profiles.filter((p) => p.role === 'coach');
  const mentors = team.profiles.filter((p) => p.role === 'mentor');
  const students = team.profiles.filter((p) => p.role === 'student' || p.role === 'admin');

  const backHref = `/komunita/tymy/${team.id}`;

  return (
    <PageShell size="wide" className="min-w-0">
      <PageBack href="/komunita" label="Zpět na komunitu" className="mb-3" />

      {/* ── Cinematic Team Hero with Group Photo Background ── */}
      <div className="relative min-h-[360px] sm:min-h-[420px] md:min-h-[460px] w-full rounded-3xl overflow-hidden shadow-lg border border-border/40 flex flex-col justify-between p-5 sm:p-8 mb-6">
        {/* Background Image / Color */}
        {teamGroupPictureUrl ? (
          <img
            src={teamGroupPictureUrl}
            alt={`Tým ${team.name}`}
            className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
          />
        ) : (
          <div
            className="absolute inset-0 bg-muted"
            style={
              teamColor
                ? { background: `linear-gradient(135deg, ${teamColor}99 0%, ${teamColor}40 60%, #1a1215 100%)` }
                : undefined
            }
          />
        )}

        {/* Cinematic dark vignette overlay (always crisp dark, never milky) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25 pointer-events-none" />

        {/* Top actions inside hero */}
        <div className="relative z-10 flex items-center justify-end gap-2">
          {canEdit && <TeamEditDialog team={team} triggerVariant="frosted" />}
        </div>

        {/* Bottom Profile Identity Row */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-6 pt-16">
          {/* Team Logo — floating card */}
          <div className="h-20 w-26 sm:h-24 sm:w-32 rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-md border border-white/20 shadow-xl p-2.5 flex items-center justify-center shrink-0 overflow-hidden">
            {teamPictureUrl ? (
              <img
                src={teamPictureUrl}
                alt={`Logo ${team.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Users className="size-8 stroke-[1.5]" />
                <span className="text-[10px] uppercase font-semibold tracking-wider mt-1">Logo</span>
              </div>
            )}
          </div>

          {/* Name, Badges, Links */}
          <div className="space-y-2 min-w-0 flex-1">
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md break-words">
              {team.name}
            </h1>

            {/* Badges row: year, member count, IČO */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {team.onboardingYear && (
                <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-xs">
                  {YEAR_LABELS[team.onboardingYear]}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white shadow-xs">
                <Users className="size-3 text-white/80" />
                {team.profiles.length} {team.profiles.length === 1 ? 'člen:ka' : team.profiles.length < 5 ? 'členové:ky' : 'členů:ek'}
              </span>

              {team.ico && (
                <a
                  href={getPublicRegistryUrl(team.ico) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white hover:bg-white/30 transition-colors shadow-xs group"
                  title="Otevřít výpis ve Veřejném rejstříku (Ministerstvo spravedlnosti)"
                >
                  <Building2 className="size-3 text-white/80 group-hover:text-white transition-colors" />
                  <span>IČO {cleanIco(team.ico)}</span>
                  <ExternalLink className="size-2.5 text-white/70 group-hover:text-white transition-colors" />
                </a>
              )}
            </div>

            {/* Social & Web links row */}
            {(team.website_url || team.instagram_url || team.linkedin_url) && (
              <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                {team.website_url && (
                  <a
                    href={formatUrl(team.website_url) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 hover:bg-black/60 transition-colors"
                  >
                    <Globe className="size-3.5 text-white/80" />
                    <span>{displayDomain(team.website_url)}</span>
                  </a>
                )}
                {team.instagram_url && (
                  <a
                    href={formatInstagramUrl(team.instagram_url) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 hover:bg-black/60 transition-colors"
                  >
                    <Instagram className="size-3.5 text-white/80" />
                    <span>{displayInstagram(team.instagram_url)}</span>
                  </a>
                )}
                {team.linkedin_url && (
                  <a
                    href={formatUrl(team.linkedin_url) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 hover:bg-black/60 transition-colors"
                  >
                    <Linkedin className="size-3.5 text-white/80" />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clenove" className="min-w-0">
          <TabsList>
            <TabsTrigger value="clenove">
              <Users />
              Členové
            </TabsTrigger>
            <TabsTrigger value="statistiky">
              <ChartColumn />
              Statistiky
            </TabsTrigger>
          </TabsList>

        <TabsContent value="clenove" className="mt-4 space-y-6">
      {/* Coaches */}
      {coaches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.coach}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coaches.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <div key={profile.id} className="relative">
                  <UserCard
                    profile={{ ...profile, team }}
                    pictureUrl={pictureUrl}
                    from={backHref}
                    showTeam={false}
                  />
                  {isAdmin && profile.id !== sessionProfile?.id && (
                    <div className="absolute top-2 right-2">
                      <TeamMemberAdminActions
                        profileId={profile.id}
                        profileName={profile.name}
                        mode="remove"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mentors */}
      {mentors.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.mentor}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mentors.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <div key={profile.id} className="relative">
                  <UserCard
                    profile={{ ...profile, team }}
                    pictureUrl={pictureUrl}
                    from={backHref}
                    showTeam={false}
                  />
                  {isAdmin && profile.id !== sessionProfile?.id && (
                    <div className="absolute top-2 right-2">
                      <TeamMemberAdminActions
                        profileId={profile.id}
                        profileName={profile.name}
                        mode="remove"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Students */}
      {students.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{ROLE_LABELS.student}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <div key={profile.id} className="relative">
                  <UserCard
                    profile={{ ...profile, team }}
                    pictureUrl={pictureUrl}
                    from={backHref}
                    showTeam={false}
                  />
                  {isAdmin && profile.id !== sessionProfile?.id && (
                    <div className="absolute top-2 right-2">
                      <TeamMemberAdminActions
                        profileId={profile.id}
                        profileName={profile.name}
                        mode="remove"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Former members — kept findable for history, excluded from active counts */}
      {formerMembers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Bývalí členové:ky</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {formerMembers.map((profile) => {
              const pictureUrl = getProfilePictureUrl(supabase, profile);
              return (
                <div key={profile.id} className="relative opacity-80">
                  <UserCard
                    profile={{ ...profile, team: null }}
                    pictureUrl={pictureUrl}
                    from={backHref}
                    showTeam={false}
                  />
                  {isAdmin && (
                    <div className="absolute top-2 right-2">
                      <TeamMemberAdminActions
                        profileId={profile.id}
                        profileName={profile.name}
                        mode="restore"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {team.profiles.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <Users className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Tým nemá žádné členy:ky</h3>
          <p className="text-sm text-muted-foreground">
            V tomto týmu zatím nikdo není
          </p>
        </div>
      )}
        </TabsContent>

        <TabsContent value="statistiky" className="mt-4">
          <Tabs defaultValue="bookpoints">
            <TabsList>
              <TabsTrigger value="bookpoints">Knižní body</TabsTrigger>
              <TabsTrigger value="schuzky">Zákaznické schůzky</TabsTrigger>
              <TabsTrigger value="koucovani">Koučování</TabsTrigger>
            </TabsList>
            <TabsContent value="bookpoints" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Knižní body — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Schválené a čekající knihy na cestu k cíli 120 bodů</p>
              </div>
              <TeamBookPointsChart stats={bookStats} />
            </TabsContent>
            <TabsContent value="schuzky" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Zákaznické schůzky — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Počet schůzek napříč členy:ky týmu</p>
              </div>
              <TeamCustomerMeetingsChart stats={meetingStats} />
            </TabsContent>
            <TabsContent value="koucovani" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Individuální koučování — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Počet koučovacích sezení napříč členy:ky týmu</p>
              </div>
              <TeamCoachingSessionsChart stats={coachingStats} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
