'use client';

import { useState } from 'react';
import { Copy, Ellipsis, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatVerifiedBooksForClipboard } from '@/lib/books/export-text';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import type { BookWithProfiles } from '@/lib/books/types';

const SHORTLIST_PAGE_SIZE = 500;

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('copy failed');
}

/**
 * Three-dots menu for the verified-books section. Fetches the full
 * shortlist on demand and copies it as grouped plain text for pasting
 * into an AI chat.
 */
export function CopyBooksMenu() {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/books?status=shortlist&sort=popular&page_size=${SHORTLIST_PAGE_SIZE}`);
      if (!res.ok) throw new Error('fetch failed');
      const { data } = (await res.json()) as { data: BookWithProfiles[] };
      const books = data ?? [];
      if (books.length === 0) {
        toast.message('Žádné ověřené knihy k zkopírování');
        return;
      }
      const categories = Object.entries(BOOK_CATEGORY_LABELS).map(([key, label]) => ({ key, label }));
      await copyTextToClipboard(formatVerifiedBooksForClipboard(books, categories));
      toast.success('Seznam knih zkopírován do schránky');
    } catch {
      toast.error('Kopírování se nezdařilo');
    } finally {
      setCopying(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8 shrink-0">
          <Ellipsis className="size-4" />
          <span className="sr-only">Možnosti seznamu knih</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy} disabled={copying} className="gap-2">
          {copying ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
          Kopírovat ověřené knihy
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
