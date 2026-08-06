'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Reply, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import type { EssayCommentWithAuthor } from '@/lib/essays/types';

interface EssayCommentThreadProps {
  essayId: string;
  initialComments: EssayCommentWithAuthor[];
  currentProfileId: string;
}

export function EssayCommentThread({
  essayId,
  initialComments,
  currentProfileId,
}: EssayCommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<EssayCommentWithAuthor | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const replyName = replyTarget?.author?.name ?? 'uživatele';

  const handlePost = async () => {
    if (!body.trim()) return;
    setIsPosting(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parent_id: replyTarget?.id ?? null }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setComments((prev) => [...prev, data]);
          setBody('');
          setReplyTarget(null);
        }
      } else {
        toast.error('Nepodařilo se odeslat komentář.');
      }
    } catch {
      toast.error('Nepodařilo se odeslat komentář.');
    } finally {
      setIsPosting(false);
    }
  };

  const startEdit = (comment: EssayCommentWithAuthor) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editBody.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: editingId, body: editBody }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setComments((prev) => prev.map((c) => (c.id === editingId ? data : c)));
          cancelEdit();
        }
      } else {
        toast.error('Nepodařilo se upravit komentář.');
      }
    } catch {
      toast.error('Nepodařilo se upravit komentář.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (comment: EssayCommentWithAuthor) => {
    if (!window.confirm('Opravdu smazat tento komentář?')) return;
    try {
      const res = await fetch(`/api/essays/${essayId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: comment.id }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setComments((prev) => prev.map((c) => (c.id === comment.id ? data : c)));
        }
      } else {
        toast.error('Nepodařilo se smazat komentář.');
      }
    } catch {
      toast.error('Nepodařilo se smazat komentář.');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Komentáře ({comments.length})</h3>

      {comments.map((comment) => {
        const isRemoved = comment.removed_at != null;
        const isOwn = comment.author_profile_id === currentProfileId;
        const isEditing = editingId === comment.id;

        return (
          <div key={comment.id} className="flex gap-3">
            {comment.author?.picture ? (
              <ProfileAvatar picture={comment.author.picture} name={comment.author.name} size={32} className="mt-0.5" />
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

              {!isRemoved && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setReplyTarget(comment);
                      setBody('');
                    }}
                  >
                    <Reply className="size-3.5" />
                    Odpovědět
                  </button>
                  {isOwn && (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(comment)}
                      >
                        <Pencil className="size-3.5" />
                        Upravit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleDelete(comment)}
                      >
                        <Trash2 className="size-3.5" />
                        Smazat
                      </button>
                    </>
                  )}
                </div>
              )}

              {isRemoved ? (
                <p className="text-xs italic text-muted-foreground">Komentář byl smazán</p>
              ) : isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) handleSaveEdit();
                    }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} disabled={!editBody.trim() || isSavingEdit}>
                      {isSavingEdit ? <Spinner className="size-3.5" /> : 'Uložit'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      Zrušit
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm">{comment.body}</p>
              )}
            </div>
          </div>
        );
      })}

      {replyTarget && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            Odpovědět na <span className="font-medium text-foreground">{replyName}</span>
          </span>
          <button type="button" className="hover:text-foreground" onClick={() => setReplyTarget(null)}>
            Zrušit
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={replyTarget ? `Odpovědět na ${replyName}...` : 'Přidat komentář...'}
          rows={2}
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) handlePost();
          }}
        />
        <Button size="icon" onClick={handlePost} disabled={!body.trim() || isPosting} aria-label="Odeslat komentář">
          {isPosting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
