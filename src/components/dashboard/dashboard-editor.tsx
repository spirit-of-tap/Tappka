'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Check,
  LayoutDashboard,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { DashboardWidgetId, DashboardWidgetMeta } from '@/lib/dashboard/types';

interface DashboardEditorProps {
  initialLayout: DashboardWidgetId[];
  catalog: DashboardWidgetMeta[];
  nodes: Partial<Record<DashboardWidgetId, ReactNode>>;
}

export function DashboardEditor({ initialLayout, catalog, nodes }: DashboardEditorProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<DashboardWidgetId[]>(initialLayout);
  const [editing, setEditing] = useState(false);

  const layoutKey = initialLayout.join(',');
  // Reconcile optimistic state after router.refresh() brings fresh server data.
  useEffect(() => {
    setLayout(layoutKey === '' ? [] : (layoutKey.split(',') as DashboardWidgetId[]));
  }, [layoutKey]);

  const remaining = catalog.filter((w) => !layout.includes(w.id));
  const labelById = new Map(catalog.map((w) => [w.id, w.label]));

  async function persist(next: DashboardWidgetId[], previous: DashboardWidgetId[]) {
    setLayout(next);
    try {
      const res = await fetch('/api/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      toast.success('Rozložení uloženo.');
    } catch {
      setLayout(previous);
      toast.error('Nepodařilo se uložit rozložení.');
    }
  }

  function add(id: DashboardWidgetId) {
    persist([...layout, id], layout);
  }

  function remove(id: DashboardWidgetId) {
    persist(layout.filter((w) => w !== id), layout);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= layout.length) return;
    const next = [...layout];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next, layout);
  }

  if (layout.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <LayoutDashboard className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Tvůj dashboard je zatím prázdný</EmptyTitle>
          <EmptyDescription>Vyber si widgety, které tu chceš mít.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto w-full">
            {catalog.map((w) => (
              <button
                key={w.id}
                onClick={() => add(w.id)}
                className="focus-ring flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <Plus className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{w.label}</span>
                  <span className="block text-xs text-muted-foreground">{w.description}</span>
                </span>
              </button>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 -mt-12 sm:-mt-2">
        {editing && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={remaining.length === 0}>
                <Plus className="size-4 mr-1.5" />
                Přidat widget
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <div className="space-y-1">
                {remaining.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => add(w.id)}
                    className="focus-ring w-full rounded-md p-2 text-left transition-colors hover:bg-muted"
                  >
                    <p className="text-sm font-medium">{w.label}</p>
                    <p className="text-xs text-muted-foreground">{w.description}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? (
            <>
              <Check className="size-4 mr-1.5" />
              Hotovo
            </>
          ) : (
            <>
              <Pencil className="size-4 mr-1.5" />
              Upravit
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {layout.map((id, index) => (
          <div
            key={id}
            className={cn(
              'relative',
              id === 'quick-actions' && 'md:col-span-2',
              editing && 'rounded-xl ring-2 ring-primary/20'
            )}
          >
            {editing && (
              <div className="absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border bg-background px-1 py-0.5 shadow-sm">
                <span className="px-1.5 text-xs font-medium text-muted-foreground">
                  {labelById.get(id)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Posunout výš"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === layout.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Posunout níž"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => remove(id)}
                  aria-label="Odebrat widget"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
            {nodes[id] ?? (
              <Card>
                <CardContent>
                  <Skeleton className="h-4 w-1/3 mb-3" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
