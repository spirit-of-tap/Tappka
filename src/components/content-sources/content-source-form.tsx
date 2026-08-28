'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CONTENT_SOURCE_KINDS, CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { CONTENT_SOURCE_POINT_VALUES, defaultContentSourcePoints } from '@/lib/content-sources/points';
import { ContentSourceIllustration } from './content-source-illustration';
import type { ContentSourceKind } from '@/lib/content-sources/types';

export function ContentSourceForm() {
  const router = useRouter();
  const [kind, setKind] = useState<ContentSourceKind | null>(null);
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [points, setPoints] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleKindChange = (next: ContentSourceKind) => {
    setKind(next);
    const fallback = defaultContentSourcePoints(next);
    setPoints(fallback == null ? '' : String(fallback));
  };

  const handleSubmit = async () => {
    if (!kind || !title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/content-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          creator: creator.trim() || null,
          description: description.trim() || null,
          external_url: externalUrl.trim() || null,
          points: points === '' ? null : Number(points),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se přidat zdroj.');
        return;
      }
      const { data } = await res.json();
      router.push(`/cteni/eseje/nova?source=${data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Typ zdroje</Label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_SOURCE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKindChange(k)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                kind === k ? 'border-primary bg-primary/5' : 'hover:bg-muted',
              )}
            >
              <ContentSourceIllustration kind={k} className="size-6 shrink-0" />
              {CONTENT_SOURCE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-title">Název</Label>
        <Input id="content-source-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-creator">Autor / lektor</Label>
        <Input id="content-source-creator" value={creator} onChange={(e) => setCreator(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-description">Popis</Label>
        <Textarea id="content-source-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-url">Odkaz</Label>
        <Input id="content-source-url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-points">Body</Label>
        <Input
          id="content-source-points"
          type="text"
          inputMode="decimal"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          list="content-source-point-values"
        />
        <datalist id="content-source-point-values">
          {CONTENT_SOURCE_POINT_VALUES.map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>

      <Button onClick={() => void handleSubmit()} disabled={!kind || !title.trim() || isSubmitting}>
        Uložit
      </Button>
    </div>
  );
}
