import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';

export function ContentSourceCard({ source }: { source: ContentSource }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <ContentSourceIllustration kind={source.kind} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{source.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {CONTENT_SOURCE_KIND_LABELS[source.kind]}
          {source.creator ? ` · ${source.creator}` : ''}
        </p>
      </div>
      {source.points != null && (
        <span className="shrink-0 text-sm font-medium">{formatPoints(source.points)} b.</span>
      )}
    </div>
  );
}
