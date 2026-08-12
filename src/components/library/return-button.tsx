'use client';

import { useState } from 'react';
import { BookCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface ReturnButtonProps {
  bookId: string;
  onReturned?: () => void;
}

export function ReturnButton({ bookId, onReturned }: ReturnButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleReturn = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/books/${bookId}/return`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Kniha vrácena');
      onReturned?.();
    } catch {
      toast.error('Nepodařilo se vrátit knihu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleReturn} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Spinner className="size-4" /> : <BookCheck className="size-4" />}
      Vrátit
    </Button>
  );
}
