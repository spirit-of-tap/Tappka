'use client';

import { ArrowRight, Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';

import { DOES_NOT_BELONG } from './types';

export function StepGate({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Patří ta kniha do BOBa?</h2>
        <p className="text-sm text-muted-foreground">
          BOB je naše knihovna doporučené literatury. Než knihu přidáš, projdi si, co do ní patří —
          kouč ji potom schvaluje a přiděluje body.
        </p>
      </div>

      <div className="space-y-3">
        {BOOK_POINT_CATEGORIES.map((category) => (
          <div key={category.points} className="rounded-xl border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{category.name}</h3>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {category.points} b.
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {category.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">Např. {category.examples}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2">
          <Ban className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold">Do BOBa naopak nepatří</h3>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {DOES_NOT_BELONG.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <Button onClick={onContinue} className="w-full gap-2 sm:w-auto">
        Ano, tuhle knihu tam chci přidat
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
