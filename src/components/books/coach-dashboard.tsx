'use client';

import { useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoachApprovalRow } from './coach-approval-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BookWithProfiles } from '@/lib/books/types';

interface CoachDashboardProps {
  initialPending: BookWithProfiles[];
  initialRejected: BookWithProfiles[];
}

export function CoachDashboard({ initialPending, initialRejected }: CoachDashboardProps) {
  const [pending, setPending] = useState(initialPending);
  const [rejected, setRejected] = useState(initialRejected);

  const handleApprove = async (bookId: string, points: 1 | 2 | 3) => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', book_points: points }),
    });
    if (res.ok) {
      setPending((prev) => prev.filter((b) => b.id !== bookId));
    }
  };

  const handleReject = async (bookId: string, reason: string) => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejection_reason: reason }),
    });
    if (res.ok) {
      const book = pending.find((b) => b.id === bookId);
      if (book) {
        setPending((prev) => prev.filter((b) => b.id !== bookId));
        setRejected((prev) => [{ ...book, status: 'rejected', rejection_reason: reason } as BookWithProfiles, ...prev]);
      }
    }
  };

  const handleRemove = async (bookId: string) => {
    const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
    if (res.ok) {
      setPending((prev) => prev.filter((b) => b.id !== bookId));
      setRejected((prev) => prev.filter((b) => b.id !== bookId));
    }
  };

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending" className="gap-2">
          Čekají na schválení
          {pending.length > 0 && <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{pending.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="rejected">Zamítnuté</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4">
        {pending.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Žádné knihy nečekají na schválení</p>
          </div>
        ) : (
          <div>
            {pending.map((book) => (
              <CoachApprovalRow
                key={book.id}
                book={book}
                onApprove={handleApprove}
                onReject={handleReject}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="rejected" className="mt-4">
        {rejected.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Žádné zamítnuté knihy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rejected.map((book) => (
              <div key={book.id} className="flex gap-3 py-3 border-b last:border-0 items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{book.title}</p>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  {book.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">Důvod: {book.rejection_reason}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleRemove(book.id)}
                  title="Smazat knihu"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
