'use client';

import { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface BorrowButtonProps {
  bookId: string;
  disabled?: boolean;
  onBorrowed?: () => void;
}

export function BorrowButton({ bookId, disabled = false, onBorrowed }: BorrowButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBorrow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/books/${bookId}/borrow`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Kniha vypůjčena');
      onBorrowed?.();
    } catch {
      toast.error('Nepodařilo se vypůjčit knihu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleBorrow} disabled={disabled || loading} className="gap-2">
      {loading ? <Spinner className="size-4" /> : <BookMarked className="size-4" />}
      Vypůjčit si
    </Button>
  );
}
