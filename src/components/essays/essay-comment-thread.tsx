'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CornerDownRight, MessageSquare, Pencil, Reply, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ROLE_LABELS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import type { EssayCommentWithAuthor } from '@/lib/essays/types';

const AVATAR_SIZE = 32;
const REPLY_AVATAR_SIZE = 24;

/** Actions stay visible rather than appearing on hover: the row reserves its
 *  height either way, so hiding it only produced a gap under every comment. */
const ACTION_ROW_CLASS = 'flex items-center gap-3 pt-1';

const ACTION_BUTTON_CLASS =
  'inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:underline disabled:opacity-50';

interface CommentThread {
  comment: EssayCommentWithAuthor;
  /** Every descendant, flattened to a single level — threads stay readable. */
  replies: EssayCommentWithAuthor[];
}

function byCreatedAt(a: EssayCommentWithAuthor, b: EssayCommentWithAuthor) {
  return a.created_at.localeCompare(b.created_at);
}

/** Walks up parent_id to the top of the chain, guarding against cycles and
 *  parents that are missing from the list. */
function findRootId(
  comment: EssayCommentWithAuthor,
  byId: Map<string, EssayCommentWithAuthor>,
): string {
  let current = comment;
  const seen = new Set([current.id]);
  while (current.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent || seen.has(parent.id)) break;
    current = parent;
    seen.add(parent.id);
  }
  return current.id;
}

function buildThreads(comments: EssayCommentWithAuthor[]): CommentThread[] {
  const sorted = [...comments].sort(byCreatedAt);
  const byId = new Map(sorted.map((c) => [c.id, c]));
  const threads = new Map<string, CommentThread>();
  const ordered: CommentThread[] = [];

  for (const comment of sorted) {
    // A comment whose parent is missing is shown as a root rather than dropped.
    if (!comment.parent_id || !byId.has(comment.parent_id)) {
      const thread = { comment, replies: [] };
      threads.set(comment.id, thread);
      ordered.push(thread);
    }
  }

  for (const comment of sorted) {
    if (threads.has(comment.id)) continue;
    threads.get(findRootId(comment, byId))?.replies.push(comment);
  }

  return ordered;
}

interface CommentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPosting: boolean;
  replyToName: string | null;
  onCancelReply: () => void;
}

function CommentComposer({
  value,
  onChange,
  onSubmit,
  isPosting,
  replyToName,
  onCancelReply,
}: CommentComposerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors focus-within:border-ring',
        replyToName && 'border-primary/40',
      )}
    >
      {replyToName && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <CornerDownRight className="size-3.5 shrink-0" />
            <span className="truncate">
              Odpovídáš na komentář:{' '}
              <span className="font-medium text-foreground">{replyToName}</span>
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onCancelReply}
          >
            Zrušit
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 p-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={replyToName ? `Odpovědět na ${replyToName}...` : 'Přidat komentář...'}
          rows={2}
          autoFocus={replyToName != null}
          className="min-h-0 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) onSubmit();
          }}
        />
        <Button
          size="icon"
          onClick={onSubmit}
          disabled={!value.trim() || isPosting}
          aria-label="Odeslat komentář"
        >
          {isPosting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

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
  const [isDeleting, setIsDeleting] = useState(false);

  const threads = buildThreads(comments);
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
    setReplyTarget(null);
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const startReply = (comment: EssayCommentWithAuthor) => {
    setReplyTarget(comment);
    setBody('');
    cancelEdit();
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
    setIsDeleting(true);
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
          if (replyTarget?.id === comment.id) setReplyTarget(null);
          if (editingId === comment.id) cancelEdit();
        }
      } else {
        toast.error('Nepodařilo se smazat komentář.');
      }
    } catch {
      toast.error('Nepodařilo se smazat komentář.');
    } finally {
      setIsDeleting(false);
    }
  };

  /** Renders one comment. `replyingTo` is set only for a flattened reply whose
   *  parent is not the thread root, where the indent alone loses the target. */
  const renderComment = (
    comment: EssayCommentWithAuthor,
    { isReply, replyingTo }: { isReply: boolean; replyingTo?: string },
  ) => {
    const isRemoved = comment.removed_at != null;
    const isOwn = comment.author_profile_id === currentProfileId;
    const isEditing = editingId === comment.id;
    const isReplyTarget = replyTarget?.id === comment.id;
    const isEdited = !isRemoved && comment.updated_at !== comment.created_at;
    const role = comment.author?.role;
    // Role reads as metadata next to the date rather than a coloured chip --
    // it is useful context on staff feedback, not the headline of a comment.
    const meta = [
      role && role !== 'student' ? ROLE_LABELS[role] : null,
      new Date(comment.created_at).toLocaleDateString('cs-CZ'),
      isEdited ? 'upraveno' : null,
    ].filter((part): part is string => part != null);

    return (
      <div
        className={cn(
          'group/comment flex gap-3 rounded-lg transition-colors',
          isReplyTarget && '-mx-2 bg-primary/5 px-2 py-1.5 ring-1 ring-primary/15',
        )}
      >
        <div className="mt-0.5 shrink-0">
          <ProfileAvatar
            picture={comment.author?.picture}
            name={comment.author?.name}
            size={isReply ? REPLY_AVATAR_SIZE : AVATAR_SIZE}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/komunita/profil/${comment.author_profile_id}`}
              className="text-sm font-medium hover:underline"
            >
              {comment.author?.name}
            </Link>
            <span
              className="text-xs text-muted-foreground"
              title={new Date(comment.created_at).toLocaleString('cs-CZ')}
            >
              {meta.join(' · ')}
            </span>
          </div>

          {replyingTo && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" />
              {replyingTo}
            </p>
          )}

          {isRemoved ? (
            <p className="mt-1 text-xs italic text-muted-foreground">Komentář byl smazán</p>
          ) : isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                autoFocus
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
            <>
              <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
              <div className={ACTION_ROW_CLASS}>
                <button
                  type="button"
                  className={ACTION_BUTTON_CLASS}
                  onClick={() => startReply(comment)}
                >
                  <Reply className="size-3.5" />
                  Odpovědět
                </button>
                {isOwn && (
                  <>
                    <button
                      type="button"
                      className={ACTION_BUTTON_CLASS}
                      onClick={() => startEdit(comment)}
                    >
                      <Pencil className="size-3.5" />
                      Upravit
                    </button>
                    <button
                      type="button"
                      className={ACTION_BUTTON_CLASS}
                      disabled={isDeleting}
                      onClick={() => handleDelete(comment)}
                    >
                      <Trash2 className="size-3.5" />
                      Smazat
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Komentáře ({comments.length})</h3>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <MessageSquare className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Zatím tu nikdo nekomentoval. Začni diskuzi.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {threads.map(({ comment, replies }) => {
            const replyIds = new Set(replies.map((r) => r.id));
            // The composer lives inside the thread it targets, so the rail
            // visually connects what you are writing to what you replied to.
            const isThreadTargeted =
              replyTarget != null && (replyTarget.id === comment.id || replyIds.has(replyTarget.id));

            return (
              <div key={comment.id}>
                {renderComment(comment, { isReply: false })}

                {(replies.length > 0 || isThreadTargeted) && (
                  <div
                    className={cn(
                      'ml-4 mt-2 space-y-3 border-l-2 pl-4 transition-colors',
                      isThreadTargeted ? 'border-primary/40' : 'border-border',
                    )}
                  >
                    {replies.map((reply) => {
                      const parentName =
                        reply.parent_id !== comment.id
                          ? (replies.find((r) => r.id === reply.parent_id)?.author?.name ??
                            undefined)
                          : undefined;
                      return (
                        <div key={reply.id}>
                          {renderComment(reply, { isReply: true, replyingTo: parentName })}
                        </div>
                      );
                    })}

                    {isThreadTargeted && (
                      <CommentComposer
                        value={body}
                        onChange={setBody}
                        onSubmit={handlePost}
                        isPosting={isPosting}
                        replyToName={replyName}
                        onCancelReply={() => setReplyTarget(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {replyTarget == null && (
        <div className="pt-1">
          <CommentComposer
            value={body}
            onChange={setBody}
            onSubmit={handlePost}
            isPosting={isPosting}
            replyToName={null}
            onCancelReply={() => setReplyTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
