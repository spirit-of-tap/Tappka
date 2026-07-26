import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Users, Phone, Cake, BookOpen, Sparkles, Pin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getProfileById, getTeamPictureUrl } from '@/lib/komunita/queries';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getUserBookPointsStats } from '@/lib/essays/queries';
import { ProfilePictureSection } from '@/components/komunita/profile-picture-section';
import { ProfilePicture } from '@/components/profile-picture';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { StorageImage } from '@/components/storage/storage-image';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { formatPointsWithLabel, pointsNumber } from '@/lib/books/points';
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
  const bookEssays = essays.filter((e) => e.book);
  const topicEssays = essays.filter((e) => !e.book);
  const teamPictureUrl = profile.team ? getTeamPictureUrl(supabase, profile.team) : null;
  const isOwnProfile = currentUserProfile?.id === profile.id;
  const teamColor = profile.team?.color ?? null;

  const pts   = (n: number) => n === 1 ? 'bod' : n < 5 ? 'body' : 'bodů';
  const eseje = (n: number) => n === 1 ? 'esej' : n < 5 ? 'eseje' : 'esejí';
  const hlasy = (n: number) => n === 1 ? 'hlas' : n < 5 ? 'hlasy' : 'hlasů';

  return (
    /* break out of the parent <main>'s p-4 so the banner is full-bleed */
    <div className="-mt-4 -mx-4">
      {/* ── Banner ── */}
      <div
        className="relative h-32 sm:h-40 bg-muted"
        style={teamColor ? { background: `linear-gradient(135deg, ${teamColor}55 0%, ${teamColor}20 70%, transparent 100%)` } : undefined}
      >
        <Link
          href={from ?? '/komunita'}
          className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm bg-background/70 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-background/90 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Zpět
        </Link>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Avatar row — overlaps banner */}
        <div className="-mt-10 mb-4 flex items-end gap-4 sm:gap-5">
          <ProfilePictureSection
            profileId={profile.id}
            profileName={profile.name}
            pictureKey={profile.picture}
            isOwnProfile={isOwnProfile}
            teamColor={teamColor ?? undefined}
            size="2xl"
          />
          {/* Name + badges float next to avatar, aligned to bottom */}
          <div className="min-w-0 pb-1 space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">{profile.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-xs', ROLE_COLORS[profile.role])}>
                {ROLE_LABELS[profile.role]}
              </Badge>
              {profile.team && (
                <Link
                  href={`/komunita/tymy/${profile.team.id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-full px-2.5 py-0.5"
                >
                  {teamPictureUrl
                    ? <ProfilePicture src={teamPictureUrl} alt={profile.team.name} size={14} className="size-3.5 rounded-full object-cover" />
                    : <Users className="size-3" />}
                  {profile.team.name}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats + contact row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4 border-y">
          {/* Stats */}
          <div className="flex items-center gap-6">
            {[
              { value: stats.approved_points, label: pts(stats.approved_points) },
              { value: stats.essay_count,    label: eseje(stats.essay_count) },
              { value: totalVotes,           label: hlasy(totalVotes) },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border hidden sm:block" />

          {/* Contact */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 min-w-0">
            <a href={`mailto:${profile.work_email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0">
              <Mail className="size-3.5 shrink-0" /><span className="truncate">{profile.work_email}</span>
            </a>
            {profile.personal_email && (
              <a href={`mailto:${profile.personal_email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0">
                <Mail className="size-3.5 shrink-0" /><span className="truncate">{profile.personal_email}</span>
              </a>
            )}
            {profile.phone_number && (
              <a href={`tel:${profile.phone_number}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="size-3.5" />{profile.phone_number}
              </a>
            )}
            {profile.date_of_birth && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cake className="size-3.5" />
                {new Date(profile.date_of_birth).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Essays ── */}
      <div className="px-4 sm:px-6 max-w-5xl mx-auto py-8 space-y-4">
        <h2 className="font-semibold text-base">
          Eseje
          {essays.length > 0 && <span className="ml-2 font-normal text-muted-foreground text-sm">{essays.length}</span>}
        </h2>

        {essays.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Zatím žádné eseje</p>
        ) : (
          <>
            {bookEssays.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {[...bookEssays].sort((a, b) => {
                  if (a.pinned_at && !b.pinned_at) return -1;
                  if (!a.pinned_at && b.pinned_at) return 1;
                  return 0;
                }).map((essay) => {
                  const excerpt = essay.content_text?.trim().replace(/\s+/g, ' ').slice(0, 120);
                  return (
                    <div key={essay.id} className="flex gap-3 rounded-xl border bg-card px-3.5 py-3 group hover:shadow-sm transition-shadow">
                      <Link href={`/eseje/${essay.id}`} className="shrink-0 w-11 h-15 rounded-md overflow-hidden bg-muted flex items-center justify-center mt-0.5" style={{ height: '60px' }}>
                        {essay.book!.google_books_cover_url ? (
                          <StorageImage storageKey={essay.book!.google_books_cover_url} alt={essay.book!.title_cs} width={44} height={60} className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="size-4 text-muted-foreground/30" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0 space-y-1">
                        <Link href={`/eseje/${essay.id}`}>
                          <p className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
                            {essay.pinned_at && <Pin className="size-3 shrink-0 text-primary fill-primary" />}
                            {essay.title}
                          </p>
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          {essay.book!.title_cs}
                          {pointsNumber(essay.book!.book_points) > 0 && <span className="ml-1 font-medium text-foreground">· {formatPointsWithLabel(essay.book!.book_points)}</span>}
                        </p>
                        {excerpt && excerpt.length > 20 && (
                          <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">{excerpt}…</p>
                        )}
                        <EssayVoteButton essayId={essay.id} initialVoteCount={essay.vote_count} initialVoted={votedIds.has(essay.id)} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {topicEssays.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 pt-2">
                  <Sparkles className="size-4 text-amber-500" />
                  <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                    Nad rámec četby
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed -mt-1">
                  Myšlenky, postřehy a záznamy, které nevznikly z přečtené knihy, ale z vlastní potřeby sdílet — bez nároku na body.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[...topicEssays].sort((a, b) => {
                    if (a.pinned_at && !b.pinned_at) return -1;
                    if (!a.pinned_at && b.pinned_at) return 1;
                    return 0;
                  }).map((essay) => {
                    const excerpt = essay.content_text?.trim().replace(/\s+/g, ' ').slice(0, 120);
                    return (
                      <div key={essay.id} className="flex gap-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/20 px-3.5 py-3 group hover:shadow-sm transition-shadow">
                        <Link href={`/eseje/${essay.id}`} className="shrink-0 w-11 h-15 rounded-md overflow-hidden bg-amber-100/50 dark:bg-amber-900/20 flex items-center justify-center mt-0.5" style={{ height: '60px' }}>
                          <Sparkles className="size-4 text-amber-500/40" />
                        </Link>
                        <div className="flex-1 min-w-0 space-y-1">
                          <Link href={`/eseje/${essay.id}`}>
                            <p className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors inline-flex items-center gap-1.5">
                              {essay.pinned_at && <Pin className="size-3 shrink-0 text-primary fill-primary" />}
                              {essay.title}
                            </p>
                          </Link>
                          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 flex items-center gap-1">
                            <Sparkles className="size-3" />
                            Nad rámec četby
                          </p>
                          {excerpt && excerpt.length > 20 && (
                            <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">{excerpt}…</p>
                          )}
                          <EssayVoteButton essayId={essay.id} initialVoteCount={essay.vote_count} initialVoted={votedIds.has(essay.id)} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
