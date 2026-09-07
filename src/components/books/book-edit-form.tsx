'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ExternalLink, RefreshCw, Rocket, Save, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import { CategoryPicker } from './category-picker';
import { GoogleBookPickerDialog } from './google-book-picker-dialog';
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
  const [titleEn, setTitleEn] = useState(book.title_en ?? '');
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description ?? '');
  const [coverUrl, setCoverUrl] = useState(book.google_books_cover_url ?? '');
  const [previewLink, setPreviewLink] = useState(book.preview_link ?? '');
  const [isbn13, setIsbn13] = useState(book.isbn_13 ?? '');
  const [tags, setTags] = useState<string[]>(book.tags);
  const [isRocketModel, setIsRocketModel] = useState(book.is_rocket_model);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isRefetchingGoogle, setIsRefetchingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
          isbn_13: isbn13.trim() || book.isbn_13,
          page_count: book.page_count,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setEnrichError(json.error ?? 'Nepodařilo se dohledat údaje');
        return;
      }
      const { data } = (await res.json()) as { data: EnrichedBook };
      if (data.title_cs) setTitle(data.title_cs);
      if (data.title_en) setTitleEn(data.title_en);
      if (data.author) setAuthor(data.author);
      if (data.description) setDescription(data.description);
      if (data.isbn_13 && !isbn13.trim()) setIsbn13(data.isbn_13);
      toast.success('Údaje byly dohledány přes AI.');
    } catch {
      setEnrichError('Nepodařilo se dohledat údaje');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleGoogleRefetch = async () => {
    if (!title.trim() && !book.title_cs) return;
    setIsRefetchingGoogle(true);
    setGoogleError(null);
    try {
      const res = await fetch(`/api/books/${book.id}/google-refetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || book.title_cs,
          author: author.trim() || book.author,
          isbn_13: isbn13.trim() || book.isbn_13,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? 'Nepodařilo se načíst z Google Books';
        setGoogleError(msg);
        toast.error(msg);
        return;
      }
      if (!json.data) {
        setGoogleError('Kniha nebyla na Google Books nalezena');
        toast.error('Kniha nebyla na Google Books nalezena');
        return;
      }
      const candidate = json.data;
      let updated = false;
      if (candidate.cover_url) {
        setCoverUrl(candidate.cover_url);
        updated = true;
      }
      if (candidate.preview_link) {
        setPreviewLink(candidate.preview_link);
        updated = true;
      }
      if (candidate.isbn_13 && !isbn13.trim()) {
        setIsbn13(candidate.isbn_13);
      }
      if (updated) {
        toast.success('Obálka a odkaz na náhled byly načteny z Google Books.');
      } else {
        toast.info('Google Books neposkytuje obálku ani odkaz na náhled pro tuto knihu.');
      }
    } catch {
      setGoogleError('Nepodařilo se načíst z Google Books');
      toast.error('Nepodařilo se načíst z Google Books');
    } finally {
      setIsRefetchingGoogle(false);
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
        body: JSON.stringify({
          action: 'edit',
          title: title.trim(),
          title_en: titleEn.trim() || null,
          author: author.trim(),
          description: description.trim() || null,
          cover_url: coverUrl.trim() || null,
          preview_link: previewLink.trim() || null,
          isbn_13: isbn13.trim() || null,
          tags,
          is_rocket_model: isRocketModel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Nepodařilo se uložit');
        return;
      }
      toast.success('Údaje o knize byly uloženy.');
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Český název *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Název v češtině"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title_en">Anglický název (originál)</Label>
          <Input
            id="title_en"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="Původní anglický název"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="author">Autor:ka *</Label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Jméno autora:ky"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isbn_13">ISBN-13</Label>
          <Input
            id="isbn_13"
            value={isbn13}
            onChange={(e) => setIsbn13(e.target.value)}
            placeholder="např. 9780593076118"
          />
        </div>
      </div>

      {/* Google Books cover & preview link section */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div className="relative aspect-[2/3] w-16 overflow-hidden rounded-md border bg-muted flex items-center justify-center shadow-xs">
              {coverUrl ? (
                <StorageImage
                  storageKey={coverUrl}
                  alt="Obálka knihy"
                  width={64}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <BookOpen className="size-6 text-muted-foreground/60" />
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="gap-2"
              >
                <Search className="size-4" />
                Vybrat z Google Books…
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoogleRefetch}
                disabled={(!title.trim() && !book.title_cs) || isRefetchingGoogle}
                className="gap-2 text-xs"
              >
                {isRefetchingGoogle ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                Rychle načíst
              </Button>
              {previewLink && (
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <a
                    href={previewLink.replace(/^http:\/\//, 'https://')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Otevřít náhled
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vyhledejte knihu na Google Books a vyberte konkrétní vydání s obálkou a náhledem, nebo použijte rychlé načtení.
            </p>
            {googleError && <p className="text-xs text-destructive">{googleError}</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/50">
          <div className="space-y-1.5">
            <Label htmlFor="cover_url" className="text-xs">URL obálky (Google Books)</Label>
            <Input
              id="cover_url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://books.google.com/..."
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preview_link" className="text-xs">Odkaz na náhled knihy</Label>
            <Input
              id="preview_link"
              value={previewLink}
              onChange={(e) => setPreviewLink(e.target.value)}
              placeholder="https://books.google.com/books?id=..."
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Popis</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEnrich}
            disabled={!title.trim() || !author.trim() || isEnriching}
            className="h-7 gap-1.5 text-xs"
          >
            {isEnriching ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
            Dohledat údaje přes AI
          </Button>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="O čem je tato kniha..."
        />
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

      <GoogleBookPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialQuery={`${title || book.title_cs || ''} ${author || book.author || ''}`.trim()}
        initialIsbn={(isbn13.trim() || book.isbn_13) ?? undefined}
        onSelect={(candidate) => {
          if (candidate.cover_url) {
            setCoverUrl(candidate.cover_url);
          }
          if (candidate.preview_link) {
            setPreviewLink(candidate.preview_link);
          }
          if (candidate.isbn_13 && !isbn13.trim()) {
            setIsbn13(candidate.isbn_13);
          }
          toast.success('Záznam z Google Books byl vybrán. Změny potvrďte uložením formuláře.');
        }}
      />
    </div>
  );
}

