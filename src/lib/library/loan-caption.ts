const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LoanCaption {
  label: string;
  isOverdue: boolean;
}

function shortDate(date: Date): string {
  return `${date.getDate()}. ${date.getMonth() + 1}.`;
}

export function loanCaption(dueAt: string, now: Date = new Date()): LoanCaption {
  const due = new Date(dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < 0) return { label: `Po termínu od ${shortDate(due)}`, isOverdue: true };
  if (diffDays === 0) return { label: 'Vrátit dnes', isOverdue: false };
  if (diffDays === 1) return { label: 'Vrátit zítra', isOverdue: false };
  return { label: `Vrátit do ${shortDate(due)}`, isOverdue: false };
}
