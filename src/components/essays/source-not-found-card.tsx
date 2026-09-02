import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

interface SourceNotFoundCardProps {
  query: string;
  essayId?: string;
}

function AddLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="focus-ring group flex flex-1 items-center gap-3 rounded-xl border border-dashed bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plus className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * Nothing matched the search — offer both ways to add it, since the author
 * hasn't told us yet whether it's a book or something else.
 */
export function SourceNotFoundCard({ query, essayId }: SourceNotFoundCardProps) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  params.set('from', 'esej');
  if (essayId) params.set('essayId', essayId);
  const qs = params.toString();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <AddLink
        href={`/cteni/knihy/nova?${qs}`}
        title="Přidat knihu"
        description="Najdi ji mimo katalog a přidej do BOBa."
      />
      <AddLink
        href={`/cteni/zdroje/nova?${qs}`}
        title="Přidat jiný zdroj"
        description="Podcast, konference, program…"
      />
    </div>
  );
}
