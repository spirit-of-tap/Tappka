'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronUp, Eye, MessageCircle } from 'lucide-react';
import { ProfilePicture } from '@/components/profile-picture';
import type { EssayWithDetails } from '@/lib/essays/types';

const INITIAL_COUNT = 8;

function Avatar({ picture, name }: { picture?: string | null; name?: string | null }) {
  const initial = name?.[0]?.toUpperCase() ?? '?';
  if (picture) {
    return <ProfilePicture src={picture} alt={name ?? ''} size={28} className="size-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

export function BookEssaysList({ essays }: { essays: EssayWithDetails[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? essays : essays.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-0.5">
      {visible.map((essay) => (
        <Link
          key={essay.id}
          href={`/eseje/${essay.id}`}
          className="group focus-ring flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:gap-3"
        >
          <div className="flex min-w-0 items-center gap-3 sm:flex-1">
            <Avatar picture={essay.author?.picture} name={essay.author?.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium group-hover:text-primary">{essay.title}</p>
              <p className="truncate text-xs text-muted-foreground">{essay.author?.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 pl-10 text-xs text-muted-foreground tabular-nums sm:pl-0">
            <span className="flex w-8 items-center justify-end gap-1" title="Hlasy">
              <ChevronUp className="size-3.5" />
              {essay.vote_count}
            </span>
            <span className="flex w-8 items-center justify-end gap-1" title="Zobrazení">
              <Eye className="size-3.5" />
              {essay.view_count}
            </span>
            <span className="flex w-8 items-center justify-end gap-1" title="Komentáře">
              <MessageCircle className="size-3.5" />
              {essay.comment_count}
            </span>
          </div>
        </Link>
      ))}

      {essays.length > INITIAL_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? 'Zobrazit méně' : `Zobrazit všech ${essays.length} esejí`}
        </button>
      )}
    </div>
  );
}
