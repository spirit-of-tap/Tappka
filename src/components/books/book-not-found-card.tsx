import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

interface BookNotFoundCardProps {
  query: string;
  from: 'hledat' | 'esej';
  essayId?: string;
}

export function BookNotFoundCard({ query, from, essayId }: BookNotFoundCardProps) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  params.set('from', from);
  if (essayId) params.set('essayId', essayId);

  return (
    <Link
      href={`/cteni/knihy/nova?${params.toString()}`}
      className="focus-ring group flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plus className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Nemůžeš najít knihu?</span>
        <span className="block text-xs text-muted-foreground">
          Najdi ji mimo katalog a přidej do BOBa.
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
