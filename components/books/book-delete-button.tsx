'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
} from '@/components/ui/alert-dialog';

interface BookDeleteButtonProps {
  bookId: string;
  bookTitle: string;
}

export function BookDeleteButton({ bookId, bookTitle }: BookDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/knihovna');
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Chyba ${res.status}`);
      }
    } catch {
      setError('Nepodařilo se připojit k serveru');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="size-4" />
          Smazat knihu
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Smazat knihu?</AlertDialogTitle>
          <AlertDialogDescription>
            Tato akce trvale smaže <strong>{bookTitle}</strong> z knihovny. Tuto akci nelze vrátit zpět.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? <Spinner className="size-4 mr-2" /> : null}
            Smazat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
