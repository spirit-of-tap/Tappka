'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { TiptapRenderer } from './tiptap-renderer';
import type { EssayRevisionSummary } from '@/lib/essays/types';

interface EssayHistorySheetProps {
  essayId: string;
}

interface OpenRevision {
  revision_no: number;
  title: string;
  content_json: object;
}

function formatRevisionDate(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EssayHistorySheet({ essayId }: EssayHistorySheetProps) {
  const [revisions, setRevisions] = useState<EssayRevisionSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState<OpenRevision | null>(null);

  // Fetched on open rather than server-rendered: autosave changes the list
  // continuously, so anything rendered at page load would already be stale.
  const loadRevisions = async (isOpen: boolean) => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/revisions`);
      const { data } = await res.json();
      setRevisions(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  const openRevision = async (revisionNo: number) => {
    const res = await fetch(`/api/essays/${essayId}/revisions/${revisionNo}`);
    const { data } = await res.json();
    if (data) setOpen(data);
  };

  return (
    <>
      <Sheet onOpenChange={loadRevisions}>
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2">
            <History className="size-4" />
            Historie
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Historie verzí</SheetTitle>
          </SheetHeader>

          {isLoading && <Spinner className="mx-auto my-8 size-5" />}

          {!isLoading && revisions?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Zatím žádné starší verze.
            </p>
          )}

          <div className="divide-y">
            {revisions?.map((revision) => (
              <button
                key={revision.revision_no}
                type="button"
                onClick={() => void openRevision(revision.revision_no)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium">
                  {revision.title.trim() ? revision.title : 'Bez názvu'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRevisionDate(revision.updated_at)} · <span>{revision.word_count} slov</span>
                </p>
                {revision.snippet && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                    {revision.snippet}
                  </p>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={open != null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title.trim() ? open.title : 'Bez názvu'}</DialogTitle>
          </DialogHeader>
          {open && <TiptapRenderer content={open.content_json} />}
        </DialogContent>
      </Dialog>
    </>
  );
}