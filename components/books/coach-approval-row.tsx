'use client';

import { useState } from 'react';
import { BookOpen, ExternalLink, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StorageImage } from '@/components/storage/storage-image';
import { Spinner } from '@/components/ui/spinner';
import type { BookWithProfiles } from '@/lib/books/types';

interface CoachApprovalRowProps {
  book: BookWithProfiles;
  onApprove: (bookId: string, points: 1 | 2 | 3) => Promise<void>;
  onReject: (bookId: string, reason: string) => Promise<void>;
  onRemove: (bookId: string) => Promise<void>;
}

export function CoachApprovalRow({ book, onApprove, onReject, onRemove }: CoachApprovalRowProps) {
  const [approvalPoints, setApprovalPoints] = useState<1 | 2 | 3>(book.suggested_points as 1 | 2 | 3 ?? 1);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(book.id, approvalPoints);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await onReject(book.id, rejectReason);
    } finally {
      setIsProcessing(false);
    }
  };

  const googleBooksUrl = book.source === 'google_books' && book.external_id
    ? `https://books.google.com/books?id=${book.external_id}`
    : null;
  const openLibraryUrl = book.source === 'open_library' && book.external_id
    ? `https://openlibrary.org${book.external_id}`
    : null;

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <div className="shrink-0 w-12 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
        {book.cover_path ? (
          <StorageImage storageKey={book.cover_path} alt={book.title} className="w-full h-full object-cover" width={48} height={64} />
        ) : (
          <BookOpen className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <p className="font-medium text-sm">{book.title}</p>
          <p className="text-xs text-muted-foreground">{book.author}</p>
          {book.isbn_13 && <p className="text-xs text-muted-foreground">ISBN: {book.isbn_13}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            Přidal/a: {book.added_by?.name} · navrhuje {book.suggested_points} {book.suggested_points === 1 ? 'bod' : 'body'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {(googleBooksUrl ?? openLibraryUrl) && (
            <a
              href={(googleBooksUrl ?? openLibraryUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" />
              {googleBooksUrl ? 'Google Books' : 'Open Library'}
            </a>
          )}
        </div>

        {!showRejectForm ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Body:</span>
              {([1, 2, 3] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={approvalPoints === p ? 'default' : 'outline'}
                  onClick={() => setApprovalPoints(p)}
                  className="h-7 w-7 p-0"
                  disabled={isProcessing}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={handleApprove} disabled={isProcessing} className="gap-1">
              {isProcessing ? <Spinner className="size-3" /> : <Check className="size-3" />}
              Schválit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRejectForm(true)} disabled={isProcessing} className="gap-1">
              <X className="size-3" />
              Zamítnout
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(book.id)}
              disabled={isProcessing}
              title="Smazat knihu"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Důvod zamítnutí..."
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || isProcessing}>
                {isProcessing ? <Spinner className="size-3 mr-1" /> : null}
                Zamítnout
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>Zrušit</Button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <Badge variant="outline" className="text-xs">Čeká</Badge>
      </div>
    </div>
  );
}
