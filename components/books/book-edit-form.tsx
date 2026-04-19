'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { CategoryPicker } from './category-picker';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookEditFormProps {
  book: BookWithProfiles;
}

export function BookEditForm({ book }: BookEditFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description ?? '');
  const [tags, setTags] = useState<string[]>(book.tags);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim() || !author.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', title, author, description, tags }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Nepodařilo se uložit'); return; }
      router.push(`/knihovna/${book.id}`);
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

      <div className="space-y-2">
        <Label>Kategorie</Label>
        <CategoryPicker selected={tags} onChange={setTags} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSave} disabled={!title.trim() || !author.trim() || isSaving} size="lg">
        {isSaving ? <Spinner className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
        Uložit změny
      </Button>
    </div>
  );
}
