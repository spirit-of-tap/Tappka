import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BookOpen, Eye, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById, getEssayComments, getEssayCoachViewers } from '@/lib/essays/queries';
import { TiptapRenderer } from '@/components/essays/tiptap-renderer';
import { EssayCommentThread } from '@/components/essays/essay-comment-thread';
import { SeenByCoachBanner } from '@/components/essays/seen-by-coach-banner';
import { ViewTracker } from '@/components/essays/view-tracker';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from '@/components/essays/essay-vote-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const coachViewers = isAuthor ? await getEssayCoachViewers(supabase, essayId) : [];

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <ViewTracker essayId={essayId} />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" asChild className="gap-2 -ml-3">
          <Link href="/eseje">
            <ArrowLeft className="size-4" />
            Zpět na eseje
          </Link>
        </Button>
        {isAuthor && (
          <Button variant="outline" asChild size="sm">
            <Link href={`/eseje/${essayId}/upravit`}>
              <Pencil className="size-4 mr-2" />
              Upravit
            </Link>
          </Button>
        )}
      </div>

      {isAuthor && coachViewers.length > 0 && (
        <div className="mb-6">
          <SeenByCoachBanner coachViewers={coachViewers} />
        </div>
      )}

      {/* Title & meta */}
      <div className="mb-6 space-y-3">
        <h1 className="text-3xl font-bold leading-tight">{essay.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {essay.author?.picture ? (
            <img src={essay.author.picture} alt={essay.author.name} className="size-6 rounded-full object-cover" />
          ) : (
            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {essay.author?.name?.[0]}
            </div>
          )}
          <span className="font-medium text-foreground">{essay.author?.name}</span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>{new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" />
            {essay.view_count}
          </span>
          <span className="text-muted-foreground/50">&middot;</span>
          <EssayVoteButton
            essayId={essayId}
            initialVoteCount={essay.vote_count}
            initialVoted={hasVoted}
            readOnly={isAuthor}
          />
        </div>
      </div>

      {/* Book source */}
      {essay.book && (
        <Link href={`/knihovna/${essay.book.id}`} className="group block mb-8">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors">
            <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
              {essay.book.cover_path ? (
                <StorageImage
                  storageKey={essay.book.cover_path}
                  alt={essay.book.title}
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
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{essay.book.title}</p>
              <p className="text-xs text-muted-foreground truncate">{essay.book.author}</p>
            </div>
            {essay.book.status === 'approved' && (
              <Badge variant="secondary" className="shrink-0">{essay.book.book_points} b.</Badge>
            )}
          </div>
        </Link>
      )}

      {/* Content */}
      <TiptapRenderer content={essay.content_json} className="mb-12" />

      <hr className="mb-8" />

      <EssayCommentThread essayId={essayId} initialComments={comments} />
    </div>
  );
}
