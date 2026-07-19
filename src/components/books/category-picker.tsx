'use client';

import { Badge } from '@/components/ui/badge';
import { BOOK_CATEGORIES, BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { cn } from '@/lib/utils';

interface CategoryPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {BOOK_CATEGORIES.map((tag) => (
        <Badge
          key={tag}
          variant={selected.includes(tag) ? 'default' : 'outline'}
          className={cn('cursor-pointer select-none transition-colors text-xs', selected.includes(tag) && 'hover:bg-primary/80')}
          onClick={() => toggle(tag)}
        >
          {BOOK_CATEGORY_LABELS[tag] ?? tag}
        </Badge>
      ))}
    </div>
  );
}
