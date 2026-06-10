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
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder="Hledat podle jména nebo emailu…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-12 pl-12 pr-12 text-base rounded-xl shadow-sm"
      />
      {search && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 p-0"
          onClick={handleClear}
        >
          <X className="size-4" />
          <span className="sr-only">Vymazat hledání</span>
        </Button>
      )}
    </div>
  );
}
