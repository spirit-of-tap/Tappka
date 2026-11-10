'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatEssaysForClipboard, type ExportableEssay } from '@/lib/essays/export-markdown';
import { copyTextToClipboard } from '@/lib/utils/clipboard';

const COPIED_FEEDBACK_MS = 2_000;

interface CopyEssaysButtonProps {
  /** One essay on a detail page, the whole list on Moje. */
  essays: ExportableEssay[];
}

/**
 * Copies essays as Markdown — people paste them into a doc or an AI chat,
 * which keeps the structure.
 */
export function CopyEssaysButton({ essays }: CopyEssaysButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (essays.length === 0) return null;

  const isSingle = essays.length === 1;
  const label = isSingle ? 'Kopírovat esej' : 'Kopírovat všechny eseje';

  async function copy() {
    try {
      await copyTextToClipboard(formatEssaysForClipboard(essays));
      setCopied(true);
      toast.success(isSingle ? 'Esej zkopírována do schránky' : 'Eseje zkopírovány do schránky');
    } catch {
      toast.error(isSingle ? 'Esej se nepodařilo zkopírovat' : 'Eseje se nepodařilo zkopírovat');
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => void copy()}
      aria-label={copied ? 'Zkopírováno' : label}
      title={copied ? 'Zkopírováno' : label}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <Check className="size-4 text-success-strong" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
