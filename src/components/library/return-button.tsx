'use client';

import { useState } from 'react';
import { BookCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface ReturnButtonProps {
  bookId: string;
  onReturned?: () => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ReturnButton({ bookId, onReturned, size = 'default', className }: ReturnButtonProps) {
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
    <Button
      onClick={handleReturn}
      disabled={loading}
      variant="outline"
      size={size}
      className={cn('gap-1.5', className)}
    >
      {loading ? <Spinner className="size-3.5" /> : <BookCheck className="size-3.5" />}
      Vrátit
    </Button>
  );
}
