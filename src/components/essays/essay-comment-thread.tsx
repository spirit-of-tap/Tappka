'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ProfilePicture } from '@/components/profile-picture';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import type { EssayCommentWithAuthor } from '@/lib/essays/types';

interface EssayCommentThreadProps {
  essayId: string;
  initialComments: EssayCommentWithAuthor[];
}

export function EssayCommentThread({ essayId, initialComments }: EssayCommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    if (!body.trim()) return;
    setIsPosting(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setComments((prev) => [...prev, data]);
          setBody('');
        }
      } else {
        toast.error('Nepodařilo se odeslat komentář.');
      }
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Komentáře ({comments.length})</h3>

      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          {comment.author?.picture ? (
            <ProfilePicture src={comment.author.picture} alt={comment.author.name ?? ''} size={32} className="size-8 rounded-full object-cover shrink-0 mt-0.5" />
          ) : (
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
              {comment.author?.name?.[0]}
            </div>
          )}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Link href={`/komunita/profil/${comment.author_profile_id}`} className="text-sm font-medium hover:underline">
                {comment.author?.name}
              </Link>
              {comment.author?.role && comment.author.role !== 'student' && (
                <Badge variant="outline" className={cn('text-xs', ROLE_COLORS[comment.author.role])}>
                  {ROLE_LABELS[comment.author.role]}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
              </span>
            </div>
            <p className="text-sm">{comment.body}</p>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Přidat komentář..."
          rows={2}
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) handlePost();
          }}
        />
        <Button size="icon" onClick={handlePost} disabled={!body.trim() || isPosting}>
          {isPosting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
