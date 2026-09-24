'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { TiptapRenderer } from '@/components/essays/tiptap-renderer';
import { contentTextFromJson, normalizeContentJson } from '@/lib/essays/content-text';
import { MAX_BIO_TEXT_LENGTH, validateBioContent } from '@/lib/profile/bio-validation';

import { BioEditor } from './bio-editor';

interface BioSectionProps {
  bioJson: object | null;
  isOwnProfile: boolean;
}

export function BioSection({ bioJson, isOwnProfile }: BioSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftJson, setDraftJson] = useState<object | null>(null);
  const [saving, setSaving] = useState(false);

  const hasBio = bioJson !== null && contentTextFromJson(bioJson).length > 0;

  if (!hasBio && !isOwnProfile) return null;

  const initialSerialized = JSON.stringify(normalizeContentJson(bioJson));
  const currentJson = draftJson ?? normalizeContentJson(bioJson);
  const charCount = contentTextFromJson(currentJson).length;
  const hasChanges = draftJson !== null && JSON.stringify(draftJson) !== initialSerialized;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setDraftJson(null);
  };

  const handleSave = async () => {
    const result = validateBioContent(currentJson);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile/bio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio_json: result.value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message =
          typeof data?.error === 'string' && data.error.length > 0
            ? data.error
            : 'Nepodařilo se uložit bio.';
        toast.error(message);
        return;
      }
      toast.success('Bio bylo uloženo.');
      setOpen(false);
      setDraftJson(null);
      router.refresh();
    } catch {
      toast.error('Nepodařilo se připojit k serveru.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {hasBio ? (
        <div className="my-2 max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <TiptapRenderer
                content={bioJson}
                className="text-sm leading-relaxed text-foreground/90 [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0"
              />
            </div>
            {isOwnProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(true)}
                className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5 mr-1" />
                Upravit bio
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="my-2 flex items-center gap-2">
          <p className="text-xs text-muted-foreground/80 italic">
            Představte se ostatním…
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(true)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3.5 mr-1" />
            Upravit bio
          </Button>
        </div>
      )}

      {isOwnProfile && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upravit bio</DialogTitle>
              <DialogDescription>
                Napište něco o sobě. Bio podporuje základní formátování, odkazy a seznamy.
              </DialogDescription>
            </DialogHeader>

            {open && (
              <BioEditor
                initialContent={bioJson}
                onChange={(json) => setDraftJson(json)}
              />
            )}

            <DialogFooter className="items-center justify-between">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {charCount} / {MAX_BIO_TEXT_LENGTH}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                  Zrušit
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving || !hasChanges}>
                  {saving && <Spinner className="size-4" />}
                  Uložit
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
