/**
 * Relative date formatting for community feeds in Czech.
 */

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) return 'právě teď';
  if (diffMinutes < 60) return `před ${diffMinutes} min`;
  if (diffHours < 24) return `před ${diffHours} h`;
  if (diffDays === 1) return 'včera';
  if (diffDays < 7) return `před ${diffDays} dny`;
  if (diffDays < 30) {
    const weeks = Math.max(1, Math.floor(diffDays / 7));
    return weeks === 1 ? 'před týdnem' : `před ${weeks} týdny`;
  }
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

export function isRecentEssay(dateString: string): boolean {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return diffMs <= 48 * 60 * 60 * 1000 && diffMs >= 0;
}

export { formatRelativeTime as formatCzechRelativeTime };
