'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { NewFeedbackForm } from './new-feedback-form';
import { FeedbackNoteCard } from './feedback-note-card';
import type { FeedbackWithAuthor } from '@/lib/feedback/types';

interface FeedbackBoardProps {
  initialActive: FeedbackWithAuthor[];
  initialArchived: FeedbackWithAuthor[];
  isAdmin: boolean;
}

const EMPTY_ACTIVE = 'Zatím tu není žádná zpětná vazba. Buď první!';
const EMPTY_ARCHIVED = 'Archiv je prázdný.';

export function FeedbackBoard({ initialActive, initialArchived, isAdmin }: FeedbackBoardProps) {
  const [active, setActive] = useState(initialActive);
  const [archived, setArchived] = useState(initialArchived);

  const handleCreated = (feedback: FeedbackWithAuthor) => {
    setActive((prev) => [feedback, ...prev]);
  };

  const handleChanged = (updated: FeedbackWithAuthor) => {
    setActive((prev) => prev.filter((f) => f.id !== updated.id));
    setArchived((prev) => prev.filter((f) => f.id !== updated.id));
    if (updated.resolved_at) {
      setArchived((prev) => [updated, ...prev]);
    } else {
      setActive((prev) => [updated, ...prev]);
    }
  };

  const handleDeleted = (id: string) => {
    setActive((prev) => prev.filter((f) => f.id !== id));
    setArchived((prev) => prev.filter((f) => f.id !== id));
  };

  const renderGrid = (notes: FeedbackWithAuthor[], emptyText: string) => {
    if (notes.length === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((f) => (
          <FeedbackNoteCard
            key={f.id}
            feedback={f}
            isAdmin={isAdmin}
            onChanged={handleChanged}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <NewFeedbackForm onCreated={handleCreated} />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Aktivní
            {active.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 p-0 px-1 text-xs">
                {active.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived">Archiv</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {renderGrid(active, EMPTY_ACTIVE)}
        </TabsContent>
        <TabsContent value="archived" className="mt-4">
          {renderGrid(archived, EMPTY_ARCHIVED)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
