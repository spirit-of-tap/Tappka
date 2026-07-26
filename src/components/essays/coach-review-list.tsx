'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, FileQuestion, Inbox, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CoachReadButton } from './coach-read-button';
import { ProfilePicture } from '@/components/profile-picture';
import type { CoachReviewEssay } from '@/lib/essays/types';

interface CoachReviewListProps {
  initialUnread: CoachReviewEssay[];
  initialRead: CoachReviewEssay[];
}

export function CoachReviewList({ initialUnread, initialRead }: CoachReviewListProps) {
  const [unread, setUnread] = useState(initialUnread);
  const [read, setRead] = useState(initialRead);

  const markRead = (essay: CoachReviewEssay) => {
    setUnread((prev) => prev.filter((e) => e.id !== essay.id));
    setRead((prev) => [{ ...essay, read_at: new Date().toISOString() }, ...prev]);
  };

  const markUnread = (essay: CoachReviewEssay) => {
    setRead((prev) => prev.filter((e) => e.id !== essay.id));
    setUnread((prev) =>
      [{ ...essay, read_at: null }, ...prev].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    );
  };

  return (
    <Tabs defaultValue="unread">
      <TabsList>
        <TabsTrigger value="unread" className="gap-2">
          Nepřečtené
          {unread.length > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">
              {unread.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="read">Přečtené</TabsTrigger>
      </TabsList>

      <TabsContent value="unread" className="mt-4">
        {unread.length === 0 ? (
          <EmptyState label="Žádné nové eseje ke kontrole" />
        ) : (
          <div className="space-y-3">
            {unread.map((essay) => (
              <ReviewRow key={essay.id} essay={essay} read={false} onToggled={() => markRead(essay)} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="read" className="mt-4">
        {read.length === 0 ? (
          <EmptyState label="Zatím jste nic neoznačil/a jako přečtené" />
        ) : (
          <div className="space-y-3">
            {read.map((essay) => (
              <ReviewRow key={essay.id} essay={essay} read onToggled={() => markUnread(essay)} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 space-y-2">
      <Inbox className="size-10 mx-auto text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

interface ReviewRowProps {
  essay: CoachReviewEssay;
  read: boolean;
  onToggled: () => void;
}

function ReviewRow({ essay, read, onToggled }: ReviewRowProps) {
  const snippet = (essay.content_text ?? '').slice(0, 160).trimEnd();
  const authorInitial = essay.author?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <Card className="py-0">
      <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
        <Link href={`/eseje/${essay.id}`} className="group flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            {essay.author?.picture ? (
              <ProfilePicture src={essay.author.picture} alt={essay.author.name ?? ''} size={24} className="size-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">
                {authorInitial}
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate">{essay.author?.name}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground">
              {new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {essay.title}
          </h3>
          {snippet && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{snippet}</p>}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {essay.book ? (
              <>
                <BookOpen className="size-3 shrink-0" />
                <span className="truncate">{essay.book.title_cs}</span>
              </>
            ) : (
              <>
                <FileQuestion className="size-3 shrink-0" />
                <span className="italic">Bez zdroje</span>
              </>
            )}
            {essay.comment_count > 0 && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <MessageCircle className="size-3 shrink-0" />
                <span>{essay.comment_count}</span>
              </>
            )}
          </div>
        </Link>

        <div className="shrink-0 sm:self-center">
          <CoachReadButton
            essayId={essay.id}
            initialRead={read}
            size="sm"
            onToggled={onToggled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
