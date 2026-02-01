'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (search) {
        params.set('search', search);
      } else {
        params.delete('search');
      }
      
      router.push(`?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, router, searchParams]);

  const handleClear = () => {
    setSearch('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Hledat podle jména nebo emailu..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9 pr-9"
      />
      {search && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 size-7 p-0"
          onClick={handleClear}
        >
          <X className="size-3.5" />
          <span className="sr-only">Vymazat hledání</span>
        </Button>
      )}
    </div>
  );
}
