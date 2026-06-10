import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Users } from 'lucide-react';
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
import { BookOpen } from 'lucide-react';

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
    getEssays(supabase, { authorProfileId: id, sort: 'best', pageSize: 50 }),
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
  const pictureUrl = getProfilePictureUrl(supabase, profile);
  const teamPictureUrl = profile.team ? getTeamPictureUrl(supabase, profile.team) : null;
  const isOwnProfile = currentUserProfile?.id === profile.id;

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      {/* Back */}
      <Link
        href={from ?? '/komunita/lide'}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Zpět
      </Link>

      {/* Profile card */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Banner */}
        <div
          className="h-24 w-full"
          style={{
            background: profile.team?.color
              ? `linear-gradient(135deg, ${profile.team.color}30 0%, ${profile.team.color}10 100%)`
              : 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)/0.4) 100%)',
          }}
        />

        {/* Avatar + info */}
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4">
            <ProfilePictureSection
              profileId={profile.id}
              profileName={profile.name}
              pictureKey={profile.picture}
              isOwnProfile={isOwnProfile}
              teamColor={profile.team?.color}
              size="xl"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight">{profile.name}</h1>
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
                    <Users className="size-3 text-muted-foreground" />
                  )}
                  {profile.team.name}
                </Link>
              )}
              <a
                href={`mailto:${profile.work_email}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-full px-2.5 py-0.5"
              >
                <Mail className="size-3" />
                {profile.work_email}
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 divide-x rounded-xl border bg-muted/30 overflow-hidden">
            <div className="px-4 py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{stats.approved_points}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.approved_points === 1 ? 'bod' : stats.approved_points < 5 ? 'body' : 'bodů'}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{stats.essay_count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.essay_count === 1 ? 'esej' : stats.essay_count < 5 ? 'eseje' : 'esejí'}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xl font-bold tabular-nums">{totalVotes}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalVotes === 1 ? 'hlas' : totalVotes < 5 ? 'hlasy' : 'hlasů'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Essays */}
      {essays.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-base">
            Eseje
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {essays.length}
            </span>
          </h2>
          <div className="space-y-2">
            {essays.map((essay) => (
              <div key={essay.id} className="flex gap-3 rounded-xl border bg-card px-3 py-2.5 group">
                {/* Book cover */}
                <Link href={`/eseje/${essay.id}`} className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center mt-0.5">
                  {essay.book?.cover_path ? (
                    <StorageImage
                      storageKey={essay.book.cover_path}
                      alt={essay.book.title}
                      width={40}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground/30" />
                  )}
                </Link>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between gap-1.5">
                  <div className="space-y-0.5">
                    <Link href={`/eseje/${essay.id}`}>
                      <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {essay.title}
                      </p>
                    </Link>
                    {essay.book && (
                      <p className="text-xs text-muted-foreground truncate">
                        {essay.book.title}
                        {essay.book.book_points ? (
                          <span className="ml-1.5 font-medium text-foreground">
                            · {essay.book.book_points} {essay.book.book_points === 1 ? 'bod' : essay.book.book_points < 5 ? 'body' : 'bodů'}
                          </span>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <EssayVoteButton
                    essayId={essay.id}
                    initialVoteCount={essay.vote_count}
                    initialVoted={votedIds.has(essay.id)}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {essays.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Zatím žádné eseje
        </div>
      )}
    </div>
  );
}
