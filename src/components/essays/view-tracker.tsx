'use client';

import { useEffect, useRef } from 'react';

interface ViewTrackerProps {
  essayId: string;
}

export function ViewTracker({ essayId }: ViewTrackerProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    fetch(`/api/essays/${essayId}/view`, { method: 'POST' }).catch(() => undefined);
  }, [essayId]);

  return null;
}
