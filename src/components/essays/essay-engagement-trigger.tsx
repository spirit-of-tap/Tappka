'use client';

import { useState } from 'react';
import { Eye, ChevronUp } from 'lucide-react';
import { EssayActivityDialog } from './essay-activity-dialog';
import { cn } from '@/lib/utils';

interface EssayEngagementTriggerProps {
  essayId: string;
  viewCount: number;
  voteCount: number;
  isAuthor: boolean;
  className?: string;
}

export function EssayEngagementTrigger({
  essayId,
  viewCount,
  voteCount,
  isAuthor,
  className,
}: EssayEngagementTriggerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'views' | 'votes'>('views');

  const openWithTab = (tab: 'views' | 'votes') => {
    setActiveTab(tab);
    setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openWithTab('views')}
        className={cn(
          'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring rounded px-1.5 py-0.5 -mx-1.5 cursor-pointer select-none',
          className,
        )}
        title="Zobrazit aktivitu u eseje"
        aria-label={`Zobrazení: ${viewCount}. Kliknutím zobrazíte detail.`}
      >
        <Eye className="size-3.5" />
        <span className="tabular-nums">{viewCount}</span>
      </button>

      {isAuthor && (
        <>
          <span className="text-muted-foreground/50 select-none">&middot;</span>
          <button
            type="button"
            onClick={() => openWithTab('votes')}
            className={cn(
              'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-ring rounded px-1.5 py-0.5 -mx-1.5 cursor-pointer select-none tabular-nums',
              className,
            )}
            title="Zobrazit, kdo dal to se mi líbí"
            aria-label={`To se mi líbí: ${voteCount}. Kliknutím zobrazíte detail.`}
          >
            <ChevronUp className="size-3" />
            <span>{voteCount}</span>
          </button>
        </>
      )}

      <EssayActivityDialog
        essayId={essayId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialTab={activeTab}
        initialViewCount={viewCount}
        initialVoteCount={voteCount}
        isAuthor={isAuthor}
      />
    </>
  );
}
