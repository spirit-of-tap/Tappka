'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import type { FeedbackWithAuthor } from '@/lib/feedback/types';

const MAX_BODY_LENGTH = 4000;

interface NewFeedbackFormProps {
  onCreated: (feedback: FeedbackWithAuthor) => void;
}

export function NewFeedbackForm({ onCreated }: NewFeedbackFormProps) {
  const [body, setBody] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const { data } = await res.json();
      if (data) {
        onCreated(data);
        setBody('');
      }
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Co máš na srdci? Napiš nám svou zpětnou vazbu…"
        rows={3}
        maxLength={MAX_BODY_LENGTH}
        aria-label="Zpětná vazba"
      />
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!body.trim() || isPosting} className="gap-2">
          {isPosting ? <Spinner className="size-4" /> : <Send className="size-4" />}
          Odeslat
        </Button>
      </div>
    </div>
  );
}
