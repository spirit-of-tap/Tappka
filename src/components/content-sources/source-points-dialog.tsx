'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

interface SourcePointsDialogProps {
  source: ContentSourceWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (source: ContentSourceWithProfiles, newPoints: number | null) => void;
}

const POINT_VALUES_DATALIST_ID = 'dialog-content-source-point-values';

export function SourcePointsDialog({
  source,
  open,
  onOpenChange,
  onSaved,
}: SourcePointsDialogProps) {
  const [points, setPoints] = useState<string>(source.points != null ? String(Number(source.points)) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const resolvedPoints = points === '' ? null : Number(points);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: resolvedPoints, status: source.status }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Nepodařilo se uložit body');
      }
      toast.success('Body byly úspěšně upraveny');
      onSaved(source, resolvedPoints);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Změnit body zdroje</DialogTitle>
          <DialogDescription className="truncate">
            {source.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <datalist id={POINT_VALUES_DATALIST_ID}>
            {CONTENT_SOURCE_POINT_VALUES.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <div className="space-y-1.5">
            <Label htmlFor="source-points-input">Počet bodů (0–3)</Label>
            <Input
              id="source-points-input"
              type="number"
              step="0.5"
              min="0"
              max="3"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              list={POINT_VALUES_DATALIST_ID}
              placeholder="Např. 1.5"
            />
            <p className="text-xs text-muted-foreground">
              Běžné hodnoty pro zdroje: 0.5, 1, 1.5, 2, 2.5 nebo 3 body.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            Uložit body
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
