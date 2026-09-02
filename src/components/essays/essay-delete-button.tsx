'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatPointsWithLabel } from '@/lib/books/points';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/responsive-alert-dialog';

interface EssayDeleteButtonProps {
  essayId: string;
  /** An essay without a title yet was never visible to anyone, so deleting it costs the author nothing. */
  hasTitle: boolean;
  /** BookPoints the essay currently earns, so the author learns what they lose. */
  points?: number;
  /** Pass to drive the dialog from elsewhere (a menu); omit to get a trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EssayDeleteButton({
  essayId,
  hasTitle,
  points = 0,
  open: openProp,
  onOpenChange,
}: EssayDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/essays/${essayId}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        toast.error(error ?? 'Nepodařilo se smazat esej.');
        setIsDeleting(false);
        return;
      }
      toast.success(hasTitle ? 'Esej smazána.' : 'Rozepsaná esej smazána.');
      // replace, not push: the editor URL now points at a deleted essay, and
      // Back should not walk into a 404.
      router.replace('/cteni/prehled');
    } catch {
      toast.error('Nepodařilo se připojit k serveru.');
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={openProp} onOpenChange={onOpenChange}>
      {openProp === undefined && (
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Smazat
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasTitle ? 'Smazat esej?' : 'Smazat rozepsanou esej?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasTitle
              ? 'Esej zmizí z tvého přehledu i z týmové stránky. Tuhle akci nevrátíš.'
              : 'Rozepsaný text se ztratí. Tuhle akci nevrátíš.'}
            {hasTitle && points > 0 && ` Přijdeš i o ${formatPointsWithLabel(points)}, které za ni máš.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? <Spinner className="mr-2 size-4" /> : <Trash2 className="mr-2 size-4" />}
            Smazat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
