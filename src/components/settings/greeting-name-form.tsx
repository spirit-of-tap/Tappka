'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_GREETING_NAME_LENGTH } from '@/lib/profile/greeting-name';

interface GreetingNameFormProps {
  initialValue: string | null;
  fallbackName: string;
}

export function GreetingNameForm({ initialValue, fallbackName }: GreetingNameFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== (initialValue ?? '');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile/greeting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_name: value }),
      });
      const data: { preferred_name?: string | null; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Nepodařilo se uložit oslovení');
      setValue(data.preferred_name ?? '');
      toast.success('Oslovení uloženo');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se uložit oslovení');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
      <Label htmlFor="greeting-name" className="font-heading text-base font-bold">
        Oslovení
      </Label>
      <p className="text-sm text-muted-foreground">
        Jak tě dashboard pozdraví. Když necháš prázdné, použije se „{fallbackName}“.
      </p>
      <div className="flex gap-2">
        <Input
          id="greeting-name"
          value={value}
          maxLength={MAX_GREETING_NAME_LENGTH}
          placeholder={fallbackName}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </Button>
      </div>
    </form>
  );
}
