import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { EssayWithDetails } from '@/lib/essays/types';

export type EssayStatusKind = 'draft' | 'pending' | 'approved' | 'rejected';

export interface EssayStatus {
  kind: EssayStatusKind;
  label: string;
}

export const ESSAY_STATUS_LABELS: Record<EssayStatusKind, string> = {
  draft: 'Koncept',
  pending: 'Čeká na kouče:ku',
  approved: 'Schváleno',
  rejected: 'Zamítnuto',
};

const ELIGIBLE_LIST_STATUSES = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);

function status(kind: EssayStatusKind): EssayStatus {
  return { kind, label: ESSAY_STATUS_LABELS[kind] };
}

/** Review state of what the essay is about; null when there is nothing to review (no source). */
export function getEssayStatus(essay: EssayWithDetails): EssayStatus | null {
  if (!essay.published_at) return status('draft');

  const source = getEssaySourceDisplay(essay);
  if (source.isFrozen) return status('approved');

  if (essay.book) {
    if (ELIGIBLE_LIST_STATUSES.has(essay.book.list_status)) return status('approved');
    return status(essay.book.list_status === 'archived' ? 'rejected' : 'pending');
  }

  if (essay.content_source) {
    const sourceStatus = essay.content_source.status;
    if (sourceStatus === 'approved') return status('approved');
    return status(sourceStatus === 'archived' ? 'rejected' : 'pending');
  }

  return null;
}
