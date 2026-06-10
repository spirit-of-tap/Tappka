import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Users, Phone, Cake, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfileById, getProfilePictureUrl, getTeamPictureUrl } from '@/lib/komunita/queries';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getUserBookPointsStats } from '@/lib/essays/queries';
import { ProfilePictureSection } from '@/components/komunita/profile-picture-section';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { StorageImage } from '@/components/storage/storage-image';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  const [profile, currentUserProfile] = await Promise.all([
    getProfileById(supabase, id),
    getCurrentUserProfile(supabase),
  ]);

  if (!profile) notFound();

  const [essays, stats] = await Promise.all([
    getEssays(supabase, { authorProfileId: id, sort: 'best', pageSize: 100 }),
    getUserBookPointsStats(supabase, id),
  ]);

  const votedIds = new Set<string>();
  if (currentUserProfile && essays.length > 0) {
    const { data } = await supabase
      .from('essay_votes')
      .select('essay_id')
      .in('essay_id', essays.map((e) => e.id))
      .eq('voter_profile_id', currentUserProfile.id);
    data?.forEach((v: { essay_id: string }) => votedIds.add(v.essay_id));
  }

  const totalVotes = essays.reduce((s, e) => s + (e.vote_count ?? 0), 0);
  const teamPictureUrl = profile.team ? getTeamPictureUrl(supabase, profile.team) : null;
  const isOwnProfile = currentUserProfile?.id === profile.id;

  const teamColor = profile.team?.color ?? null;
  const bannerBg = teamColor
    ? `linear-gradient(135deg, ${teamColor}60 0%, ${teamColor}25 60%, ${teamColor}10 100%)`
    : undefined;

  const pts = (n: number) => n === 1 ? 'bod' : n < 5 ? 'body' : 'bodů';
  const eseje = (n: number) => n === 1 ? 'esej' : n < 5 ? 'eseje' : 'esejí';
  const hlasy = (n: number) => n === 1 ? 'hlas' : n < 5 ? 'hlasy' : 'hlasů';

  return (
    <div className="min-h-screen">
      {/* Banner */}
      <div
        className="relative h-36 w-full bg-muted"
        style={bannerBg ? { background: bannerBg } : undefined}
      >
        <Link
          href={from ?? '/komunita/lide'}
          className="absolute top-4 left-5 inline-flex items-center gap-1.5 text-sm bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-background/90 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Zpět
        </Link>
      </div>

      {/* Main content */}
      <div className="px-5 pb-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[280px,1fr] gap-8 items-start">

          {/* ── Sidebar ── */}
          <div className="mt-0 lg:-mt-16 lg:sticky lg:top-4 space-y-3">
            <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-4">

              {/* Avatar */}
              <ProfilePictureSection
                profileId={profile.id}
                profileName={profile.name}
                pictureKey={profile.picture}
                isOwnProfile={isOwnProfile}
                teamColor={teamColor ?? undefined}
                size="xl"
              />

              {/* Name + badges */}
              <div className="space-y-2">
                <h1 className="text-xl font-bold leading-tight">{profile.name}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('text-xs', ROLE_COLORS[profile.role])}>
                    {ROLE_LABELS[profile.role]}
                  </Badge>
                  {profile.team && (
                    <Link
                      href={`/komunita/tymy/${profile.team.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-full px-2.5 py-0.5"
                    >
                      {teamPictureUrl ? (
                        <img src={teamPictureUrl} alt={profile.team.name} className="size-3.5 rounded-full object-cover" />
                      ) : (
                        <Users className="size-3 shrink-0" />
                      )}
                      {profile.team.name}
                    </Link>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 overflow-hidden">
                {[
                  { value: stats.approved_points, label: pts(stats.approved_points) },
                  { value: stats.essay_count, label: eseje(stats.essay_count) },
                  { value: totalVotes, label: hlasy(totalVotes) },
                ].map(({ value, label }) => (
                  <div key={label} className="py-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Contact */}
              <div className="space-y-1.5 pt-1 border-t">
                <a href={`mailto:${profile.work_email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors pt-3">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{profile.work_email}</span>
                </a>
                {profile.personal_email && (
                  <a href={`mailto:${profile.personal_email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{profile.personal_email}</span>
                  </a>
                )}
                {profile.phone_number && (
                  <a href={`tel:${profile.phone_number}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="size-3.5 shrink-0" />
                    {profile.phone_number}
                  </a>
                )}
                {profile.date_of_birth && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Cake className="size-3.5 shrink-0" />
                    {new Date(profile.date_of_birth).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Essays ── */}
          <div className="pt-5 space-y-4">
            <h2 className="font-semibold text-base">
              Eseje
              {essays.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{essays.length}</span>
              )}
            </h2>

            {essays.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Zatím žádné eseje</p>
            ) : (
              <div className="space-y-2.5">
                {essays.map((essay) => {
                  const excerpt = essay.content_text?.trim().replace(/\s+/g, ' ').slice(0, 160);
                  return (
                    <div key={essay.id} className="flex gap-4 rounded-xl border bg-card px-4 py-3.5 group hover:shadow-sm transition-shadow">
                      <Link href={`/eseje/${essay.id}`} className="shrink-0 w-12 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center mt-0.5">
                        {essay.book?.cover_path ? (
                          <StorageImage
                            storageKey={essay.book.cover_path}
                            alt={essay.book.title}
                            width={48}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="size-4 text-muted-foreground/30" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <Link href={`/eseje/${essay.id}`}>
                          <p className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                            {essay.title}
                          </p>
                        </Link>
                        {essay.book && (
                          <p className="text-xs text-muted-foreground">
                            {essay.book.title}
                            {essay.book.book_points ? (
                              <span className="ml-1.5 font-medium text-foreground">
                                · {essay.book.book_points} {pts(essay.book.book_points)}
                              </span>
                            ) : null}
                          </p>
                        )}
                        {excerpt && excerpt.length > 20 && (
                          <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                            {excerpt}{(essay.content_text?.length ?? 0) > 160 ? '…' : ''}
                          </p>
                        )}
                        <EssayVoteButton
                          essayId={essay.id}
                          initialVoteCount={essay.vote_count}
                          initialVoted={votedIds.has(essay.id)}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
