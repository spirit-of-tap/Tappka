import { Check, Search, Send, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The four stages of adding a book, as one component in two densities.
 *
 * Krok 1 renders it `expanded` — that screen's whole job is to teach the journey,
 * so the map *is* the explanation and replaces the paragraph that used to be there.
 * Kroky 2–4 render it `compact` as the progress indicator. Same nodes, same order,
 * so the strip a submitter learned on the first screen is the one tracking them.
 */
export type FlowNode = 'gate' | 'search' | 'enriching' | 'review';

interface NodeSpec {
  node: FlowNode;
  icon: LucideIcon;
  label: string;
  /** Only drawn in the expanded variant, where there is room to say what happens. */
  detail: string;
}

const NODES: readonly NodeSpec[] = [
  { node: 'gate', icon: ShieldCheck, label: 'Pravidla', detail: 'Co do BOBa patří' },
  { node: 'search', icon: Search, label: 'Najdi knihu', detail: 'Podle názvu nebo ISBN' },
  { node: 'enriching', icon: Sparkles, label: 'AI to doplní', detail: 'Popis, údaje a body' },
  { node: 'review', icon: Send, label: 'Odeslat kouči', detail: 'Kouč knihu schválí' },
] as const;

const NODE_INDEX: Record<FlowNode, number> = {
  gate: 0,
  search: 1,
  enriching: 2,
  review: 3,
};

interface FlowMapProps {
  active: FlowNode;
  variant: 'expanded' | 'compact';
}

export function FlowMap({ active, variant }: FlowMapProps) {
  const activeIndex = NODE_INDEX[active];

  return (
    <ol
      aria-label="Postup přidání knihy"
      className={cn(
        'flex items-start',
        variant === 'expanded' ? 'gap-1 sm:gap-2' : 'gap-2',
      )}
    >
      {NODES.map((spec, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;

        return (
          <li
            key={spec.node}
            aria-current={current ? 'step' : undefined}
            data-state={done ? 'done' : current ? 'current' : 'upcoming'}
            className={cn(
              'flex min-w-0 flex-1 flex-col',
              variant === 'expanded' ? 'items-center gap-2' : 'gap-1.5',
            )}
          >
            {variant === 'expanded' ? (
              <ExpandedNode spec={spec} done={done} current={current} index={index} />
            ) : (
              <CompactNode spec={spec} done={done} current={current} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface NodeProps {
  spec: NodeSpec;
  done: boolean;
  current: boolean;
}

function ExpandedNode({ spec, done, current, index }: NodeProps & { index: number }) {
  const Icon = done ? Check : spec.icon;

  return (
    <>
      <div className="flex w-full items-center gap-1">
        {/* Rules sit between the circles, not under them, so the row reads as one path. */}
        <span
          aria-hidden
          className={cn('h-px flex-1', index === 0 ? 'bg-transparent' : 'bg-border')}
        />
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors',
            current
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
        </span>
        <span
          aria-hidden
          className={cn(
            'h-px flex-1',
            index === NODES.length - 1 ? 'bg-transparent' : 'bg-border',
          )}
        />
      </div>
      <div className="space-y-0.5 text-center">
        <p
          className={cn(
            'font-heading text-[0.8125rem] leading-tight font-semibold',
            current ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {spec.label}
        </p>
        <p className="hidden text-xs leading-tight text-muted-foreground/80 sm:block">
          {spec.detail}
        </p>
      </div>
    </>
  );
}

function CompactNode({ spec, done, current }: NodeProps) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'h-1 w-full rounded-full transition-colors',
          current ? 'bg-primary' : done ? 'bg-primary/35' : 'bg-border',
        )}
      />
      {/* Only the current label is spelled out; the rest stay available to screen
          readers so the strip is still a legible list of four steps. */}
      <span
        className={cn(
          'truncate text-xs',
          current ? 'font-medium text-foreground' : 'sr-only',
        )}
      >
        {spec.label}
      </span>
    </>
  );
}
