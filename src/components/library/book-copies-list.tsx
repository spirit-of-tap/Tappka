import { AlertTriangle } from 'lucide-react';
import { ProfilePicture } from '@/components/profile-picture';
import { cn } from '@/lib/utils';
import type { BookCopyStatus } from '@/lib/library/types';

function formatDueDate(dueAt: string): string {
  return new Date(dueAt).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysOverdue(dueAt: string): number {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function dayLabel(days: number): string {
  if (days === 1) return 'den';
  if (days >= 2 && days <= 4) return 'dny';
  return 'dní';
}

function BorrowerAvatar({ picture, name }: { picture?: string | null; name?: string | null }) {
  const initial = name?.[0]?.toUpperCase() ?? '?';
  if (picture) {
    return (
      <ProfilePicture
        src={picture}
        alt={name ?? ''}
        size={24}
        className="size-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

interface BookCopiesListProps {
  copies: BookCopyStatus[];
}

export function BookCopiesList({ copies }: BookCopiesListProps) {
  return (
    <ul className="divide-y divide-border/60">
      {copies.map((copy, index) => {
        const isOverdue = copy.isOverdue && copy.dueAt;
        const overdueDays = isOverdue ? daysOverdue(copy.dueAt!) : 0;

        return (
          <li
            key={copy.id}
            className={cn(
              'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0',
              isOverdue && '-mx-3 rounded-md bg-destructive/5 px-3',
            )}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  !copy.borrower ? 'bg-success' : 'bg-destructive',
                )}
              />
              <span className="text-sm font-medium">Kopie {index + 1}</span>
            </span>

            {!copy.borrower ? (
              <span className="text-sm font-medium text-success-strong">Dostupná</span>
            ) : isOverdue ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-sm text-destructive">
                <BorrowerAvatar picture={copy.borrower.picture} name={copy.borrower.name} />
                <AlertTriangle className="size-3.5 shrink-0" />
                <span className="font-medium">{copy.borrower.name ?? 'Neznámý uživatel'}</span>
                <span>
                  · po termínu {overdueDays} {dayLabel(overdueDays)} (mělo být vráceno {formatDueDate(copy.dueAt!)})
                </span>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <BorrowerAvatar picture={copy.borrower.picture} name={copy.borrower.name} />
                <span className="font-medium text-foreground">{copy.borrower.name ?? 'Neznámý uživatel'}</span>
                {copy.dueAt && <span>· do {formatDueDate(copy.dueAt)}</span>}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
