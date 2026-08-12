'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { CategoryPicker } from './category-picker';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookEditFormProps {
  book: BookWithProfiles;
  /** When provided, called with the saved book instead of navigating to the detail page. */
  onSaved?: (book: BookWithProfiles) => void;
  /**
   * When provided, a Zrušit button sits beside Uložit and the footer switches to
   * the compact size — for the form embedded in a surface the user can back out of
   * (the review workbench) rather than a page they navigated to.
   */
  onCancel?: () => void;
}

export function BookEditForm({ book, onSaved, onCancel }: BookEditFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(book.title_cs);
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description ?? '');
  const [tags, setTags] = useState<string[]>(book.tags);
  const [isRocketModel, setIsRocketModel] = useState(book.is_rocket_model);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const handleEnrich = async () => {
    if (!title.trim() || !author.trim()) return;
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch('/api/books/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          isbn_13: book.isbn_13,
          page_count: book.page_count,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setEnrichError(json.error ?? 'Nepodařilo se dohledat údaje');
        return;
      }
      const { data } = (await res.json()) as { data: EnrichedBook };
      setTitle(data.title_cs);
      setAuthor(data.author);
      setDescription(data.description);
    } catch {
      setEnrichError('Nepodařilo se dohledat údaje');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !author.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', title, author, description, tags, is_rocket_model: isRocketModel }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Nepodařilo se uložit'); return; }
      if (onSaved) {
        onSaved({ ...json.data, tags });
        return;
      }
      router.push(`/cteni/knihy/${book.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Název *</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="author">Autor *</Label>
        <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Popis</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="O čem je tato kniha..." />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEnrich}
          disabled={!title.trim() || !author.trim() || isEnriching}
          className="gap-2"
        >
          {isEnriching ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
          Dohledat údaje přes AI
        </Button>
        {enrichError && <p className="text-sm text-destructive">{enrichError}</p>}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="is-rocket-model" className="flex items-center gap-2">
            <Rocket className="size-4" />
            Rocket Model
          </Label>
          <p className="text-xs text-muted-foreground">Zařadit knihu do metodiky Rocket Model</p>
        </div>
        <Switch id="is-rocket-model" checked={isRocketModel} onCheckedChange={setIsRocketModel} />
      </div>

      <div className="space-y-2">
        <Label>Kategorie</Label>
        <CategoryPicker selected={tags} onChange={setTags} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!title.trim() || !author.trim() || isSaving}
          size={onCancel ? 'default' : 'lg'}
        >
          {isSaving ? <Spinner className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
          Uložit změny
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Zrušit
          </Button>
        )}
      </div>
    </div>
  );
}
