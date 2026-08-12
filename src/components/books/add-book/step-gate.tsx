'use client';

import { ArrowRight, Ban, CircleCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/storage/storage-image';
import type { GateExemplar } from '@/lib/books/types';

import { DOES_NOT_BELONG_CHIPS } from './types';

/** Below this, the shelf is one lonely cover and reads as an accident. */
const MIN_EXEMPLARS = 2;

const COVER_WIDTH = 96;
const COVER_HEIGHT = 144;

interface StepGateProps {
  exemplars: GateExemplar[];
  onContinue: () => void;
}

export function StepGate({ exemplars, onContinue }: StepGateProps) {
  const showShelf = exemplars.length >= MIN_EXEMPLARS;

  return (
    <div className="space-y-7">
      <h2 className="font-heading text-xl font-bold">Co patří do BOBa?</h2>

      {showShelf && (
        <section className="space-y-3">
          <ShelfLabel
            icon={<CircleCheck className="size-4 text-success-strong" />}
            text="Tyhle knihy hledáme"
          />
          {/* One shelf that scrolls, never two rows that wrap — a wrapped shelf
              stops looking like a shelf. Negative margin lets it bleed to the
              screen edge inside the page's padding. */}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {exemplars.map((book) => (
              <li key={book.id} className="w-24 shrink-0 snap-start space-y-1.5">
                <StorageImage
                  storageKey={book.google_books_cover_url}
                  alt={book.title_cs}
                  width={COVER_WIDTH}
                  height={COVER_HEIGHT}
                  className="h-36 w-24 rounded-md object-cover shadow-sm ring-1 ring-border"
                />
                <div>
                  <p className="truncate text-xs font-medium" title={book.title_cs}>
                    {book.title_cs}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={book.author}>
                    {book.author}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <ShelfLabel
          icon={<Ban className="size-4 text-destructive" />}
          text="Tyhle ne"
        />
        <ul className="flex flex-wrap gap-2">
          {DOES_NOT_BELONG_CHIPS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Nejsi si jistý? Přidej ji — kouč rozhodne.
        </p>
        <Button onClick={onContinue} size="lg" className="w-full gap-2 sm:w-auto">
          Pojďme na to
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ShelfLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {text}
    </h3>
  );
}
