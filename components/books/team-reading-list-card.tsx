import { StorageImage } from '@/components/storage/storage-image';
import { BookOpen } from 'lucide-react';
import type { TeamReadingList } from '@/lib/books/team-lists';

interface TeamReadingListCardProps {
  list: TeamReadingList;
}

export function TeamReadingListCard({ list }: TeamReadingListCardProps) {
  const covers = list.books.slice(0, 4);

  return (
    <div className="shrink-0 w-44 rounded-xl border bg-card p-3 space-y-2.5 hover:shadow-md transition-shadow">
      {/* Stacked covers */}
      <div className="flex gap-1 h-20">
        {covers.length === 0 ? (
          <div className="w-full h-full rounded-md bg-muted flex items-center justify-center">
            <BookOpen className="size-6 text-muted-foreground/40" />
          </div>
        ) : (
          covers.map(({ book }, i) => (
            <div
              key={book.id}
              className="flex-1 rounded-md overflow-hidden bg-muted"
              style={{ opacity: 1 - i * 0.08 }}
            >
              {book.cover_path ? (
                <StorageImage
                  storageKey={book.cover_path}
                  alt={book.title}
                  width={40}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="size-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div>
        <p className="font-semibold text-sm leading-snug line-clamp-1">{list.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {list.team?.name}
          {list.month && ` · ${new Date(list.month + '-01').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`}
        </p>
      </div>
    </div>
  );
}
