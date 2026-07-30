import { BookOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface LibraryStatusBadgeProps {
  inLibrary: boolean;
  availableCopies: number;
  totalCopies: number;
}

export function LibraryStatusBadge({ inLibrary, availableCopies, totalCopies }: LibraryStatusBadgeProps) {
  if (!inLibrary) return null;

  return (
    <Badge variant="outline" className="gap-1.5 border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs px-2 py-1">
      <BookOpen className="size-3.5" />
      <span>🏫 TAP Knihovna</span>
      <span className="text-blue-500 dark:text-blue-400">·</span>
      <span className="font-normal text-blue-600 dark:text-blue-300">
        {availableCopies} dostupných kopií
      </span>
    </Badge>
  );
}
