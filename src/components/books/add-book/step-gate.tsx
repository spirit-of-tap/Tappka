'use client';

import { ArrowRight, Ban, CircleCheck, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { BELONGS_CHIPS, DOES_NOT_BELONG_CHIPS } from './types';

export function StepGate({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-7">
      <h2 className="font-heading text-xl font-bold">Co patří do BOBa?</h2>

      <ChipGroup
        icon={CircleCheck}
        iconClassName="text-success-strong"
        heading="Tyhle knihy hledáme"
        chips={BELONGS_CHIPS}
        tone="wanted"
      />

      <ChipGroup
        icon={Ban}
        iconClassName="text-destructive"
        heading="Tyhle ne"
        chips={DOES_NOT_BELONG_CHIPS}
        tone="unwanted"
      />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Váháš? Přidej ji — kouč:ka rozhodne.
        </p>
        <Button onClick={onContinue} size="lg" className="w-full gap-2 sm:w-auto">
          Pojďme na to
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface ChipGroupProps {
  icon: LucideIcon;
  iconClassName: string;
  heading: string;
  chips: readonly { icon: LucideIcon; label: string }[];
  tone: 'wanted' | 'unwanted';
}

/**
 * Both sides of the gate are chips, so the tones have to carry the difference:
 * what we want sits forward in a green-tinted chip at readable size, what we
 * refuse recedes into a quiet muted one. Reading the screen at a glance should
 * be enough to tell the two groups apart without reading a word.
 */
function ChipGroup({ icon: Icon, iconClassName, heading, chips, tone }: ChipGroupProps) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn('size-4 shrink-0', iconClassName)} />
        {heading}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {chips.map(({ icon: ChipIcon, label }) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2 rounded-full border',
              tone === 'wanted'
                ? 'border-success/30 bg-success/10 px-3.5 py-2 text-sm font-medium'
                : 'border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground',
            )}
          >
            <ChipIcon
              className={cn(
                'shrink-0',
                tone === 'wanted' ? 'size-4 text-success-strong' : 'size-3.5',
              )}
            />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
