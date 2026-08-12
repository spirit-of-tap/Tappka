'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { pointsNumber } from '@/lib/books/points';
import type { BookWithProfiles } from '@/lib/books/types';

function initialPoints(book: BookWithProfiles): 1 | 2 | 3 {
  const n = pointsNumber(book.book_points);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

interface PointsDialogProps {
  book: BookWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated book when points are saved. */
  onSaved: (book: BookWithProfiles) => void;
}

export function PointsDialog({ book, open, onOpenChange, onSaved }: PointsDialogProps) {
  const [points, setPoints] = useState<1 | 2 | 3>(() => initialPoints(book));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'points', book_points: points }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Nepodařilo se uložit body');
        return;
      }
      toast.success('Body uloženy.');
      onSaved({ ...book, book_points: points });
      onOpenChange(false);
    } catch {
      setError('Nepodařilo se připojit k serveru');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Změnit body</DialogTitle>
          <DialogDescription>
            Body pro <strong>{book.title_cs}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Body:</Label>
          {([1, 2, 3] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant={points === p ? 'default' : 'outline'}
              onClick={() => setPoints(p)}
              className={cn('h-9 w-9 p-0', points === p && 'pointer-events-none')}
            >
              {p}
            </Button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
