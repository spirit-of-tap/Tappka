'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BOOK_CATEGORIES, BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { cn } from '@/lib/utils';

export function LibraryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeTags = searchParams.getAll('tag');
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');

    for (const [key, value] of Object.entries(updates)) {
      params.delete(key);
      if (value === null) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else if (value) {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, [router, pathname, searchParams]);

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update({ q: value || null });
    }, 350);
  };

  const clearSearch = () => {
    setInputValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    update({ q: null });
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const toggleTag = (tag: string) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    update({ tag: next.length ? next : null });
  };

  const clearAll = () => { setInputValue(''); update({ q: null, tag: null }); };
  const hasFilters = inputValue || activeTags.length > 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Hledat knihu nebo autora..."
          className="pl-9 pr-9"
        />
        {inputValue && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {BOOK_CATEGORIES.map((tag) => (
          <Badge
            key={tag}
            variant={activeTags.includes(tag) ? 'default' : 'outline'}
            className={cn('cursor-pointer select-none transition-colors', activeTags.includes(tag) && 'hover:bg-primary/80')}
            onClick={() => toggleTag(tag)}
          >
            {BOOK_CATEGORY_LABELS[tag] ?? tag}
          </Badge>
        ))}
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">
            Zrušit filtry
          </button>
        )}
      </div>
    </div>
  );
}
