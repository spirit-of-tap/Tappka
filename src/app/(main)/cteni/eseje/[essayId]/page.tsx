import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BookOpen, Eye, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById, getEssayComments, getEssayCoachViewers, getEssayCoachReads } from '@/lib/essays/queries';
import { TiptapRenderer } from '@/components/essays/tiptap-renderer';
import { EssayCommentThread } from '@/components/essays/essay-comment-thread';
import { SeenByCoachBanner } from '@/components/essays/seen-by-coach-banner';
import { ReadByCoachBanner } from '@/components/essays/read-by-coach-banner';
import { CoachReadButton } from '@/components/essays/coach-read-button';
import { ViewTracker } from '@/components/essays/view-tracker';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { EssayPinButton } from '@/components/essays/essay-pin-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/ui/page-shell';
import { BackButton } from '@/components/essays/back-button';
import { ProfilePicture } from '@/components/profile-picture';
import { formatPoints } from '@/lib/books/points';
import { BookStatusBadges } from '@/components/books/book-status-badges';

interface PageProps {
  params: Promise<{ essayId: string }>;
}

export default async function EssayDetailPage({ params }: PageProps) {
  const { essayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  const [essay, comments, voteResult] = await Promise.all([
    getEssayById(supabase, essayId),
    getEssayComments(supabase, essayId),
    profile
      ? supabase.from('essay_votes').select('essay_id').eq('essay_id', essayId).eq('voter_profile_id', profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!essay) notFound();

  const isAuthor = profile?.id === essay.author_profile_id;
  const hasVoted = !!voteResult.data;
  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'admin';

  const coachViewers = isAuthor ? await getEssayCoachViewers(supabase, essayId) : [];

  let coachReads: Awaited<ReturnType<typeof getEssayCoachReads>> = [];
  let canReview = false;
  if (isAuthor) {
    coachReads = await getEssayCoachReads(supabase, essayId);
  } else if (isCoachOrAdmin && profile) {
    const [reads, reviewable] = await Promise.all([
      getEssayCoachReads(supabase, essayId),
      supabase.rpc('coach_can_review_essay', { p_essay_id: essayId }),
    ]);
    coachReads = reads;
    canReview = reviewable.data === true;
  }
  const alreadyRead = profile ? coachReads.some((r) => r.coach_profile_id === profile.id) : false;

  return (
    <PageShell size="narrow">
      <ViewTracker essayId={essayId} />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <BackButton />
        {isAuthor && (
          <div className="flex items-center gap-2">
            <EssayPinButton essayId={essayId} isPinned={essay.pinned_at != null} />
            <Button variant="outline" asChild size="sm">
              <Link href={`/cteni/eseje/${essayId}/upravit`}>
                <Pencil className="size-4 mr-2" />
                Upravit
              </Link>
            </Button>
          </div>
        )}
        {canReview && (
          <CoachReadButton essayId={essayId} initialRead={alreadyRead} size="sm" />
        )}
      </div>

      {isAuthor && (coachReads.length > 0 || coachViewers.length > 0) && (
        <div className="mb-6 space-y-2">
          {coachReads.length > 0 && <ReadByCoachBanner reads={coachReads} />}
          {coachViewers.length > 0 && <SeenByCoachBanner coachViewers={coachViewers} />}
        </div>
      )}

      {/* Title & meta */}
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-bold leading-tight">{essay.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href={`/komunita/profil/${essay.author_profile_id}`} className="flex items-center gap-2 hover:underline">
            {essay.author?.picture ? (
              <ProfilePicture src={essay.author.picture} alt={essay.author.name ?? ''} size={24} className="size-6 rounded-full object-cover" />
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {essay.author?.name?.[0]}
              </div>
            )}
            <span className="font-medium text-foreground">{essay.author?.name}</span>
          </Link>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>{new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" />
            {essay.view_count}
          </span>
          {isAuthor && (
            <>
              <span className="text-muted-foreground/50">&middot;</span>
              <EssayVoteButton
                essayId={essayId}
                initialVoteCount={essay.vote_count}
                initialVoted={hasVoted}
                readOnly
              />
            </>
          )}
        </div>
      </div>

      {/* Book source */}
      {essay.book && (
        <Link href={`/cteni/knihy/${essay.book.id}`} className="group block mb-8">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors">
            <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
              {essay.book.google_books_cover_url ? (
                <StorageImage
                  storageKey={essay.book.google_books_cover_url}
                  alt={essay.book.title_cs}
                  className="w-full h-full object-cover"
                  width={36}
                  height={48}
                />
              ) : (
                <BookOpen className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Zdroj</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{essay.book.title_cs}</p>
                <BookStatusBadges book={essay.book} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{essay.book.author}</p>
            </div>
            {essay.book.list_status !== 'archived' && (
              <Badge variant="secondary" className="shrink-0">{formatPoints(essay.book.book_points)} b.</Badge>
            )}
          </div>
        </Link>
      )}

      {/* Content */}
      <TiptapRenderer content={essay.content_json} className="mb-12" />

      {/* Vote CTA */}
      {!isAuthor && (
        <div className="flex items-center gap-4 px-4 py-4 mb-8 rounded-xl bg-muted/40">
          <EssayVoteButton
            essayId={essayId}
            initialVoteCount={essay.vote_count}
            initialVoted={hasVoted}
            size="lg"
          />
        </div>
      )}

      <EssayCommentThread essayId={essayId} initialComments={comments} />
    </PageShell>
  );
}
