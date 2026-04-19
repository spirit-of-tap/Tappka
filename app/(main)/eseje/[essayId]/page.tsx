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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BOOK_STATUS_COLORS } from '@/lib/books/types';
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

  const [essay, comments] = await Promise.all([
    getEssayById(supabase, essayId),
    getEssayComments(supabase, essayId),
  ]);

  if (!essay) notFound();

  const isAuthor = profile?.id === essay.author_profile_id;

  const coachViewers = isAuthor
    ? await getEssayCoachViewers(supabase, essayId)
    : [];

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <ViewTracker essayId={essayId} />

      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="gap-2">
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
        <SeenByCoachBanner coachViewers={coachViewers} />
      )}

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{essay.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <span>{essay.author?.name}</span>
          <span>&middot;</span>
          <span>{new Date(essay.created_at).toLocaleDateString('cs-CZ')}</span>
          <span>&middot;</span>
          <div className="flex items-center gap-1">
            <Eye className="size-3.5" />
            <span>{essay.view_count}</span>
          </div>
        </div>
      </div>

      {essay.book && (
        <Link href={`/knihovna/${essay.book.id}`}>
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-fit hover:opacity-80 transition-opacity', BOOK_STATUS_COLORS[essay.book.status])}>
            <BookOpen className="size-4" />
            <span className="font-medium">{essay.book.title}</span>
            <span className="text-muted-foreground">{essay.book.author}</span>
            {essay.book.status === 'approved' && (
              <Badge variant="secondary" className="ml-1">{essay.book.book_points} b.</Badge>
            )}
            {essay.book.status === 'rejected' && (
              <Badge variant="outline" className="ml-1">0 b.</Badge>
            )}
          </div>
        </Link>
      )}

      <div className="prose dark:prose-invert max-w-none">
        <TiptapRenderer content={essay.content_json} />
      </div>

      <hr />

      <EssayCommentThread essayId={essayId} initialComments={comments} />
    </div>
  );
}
