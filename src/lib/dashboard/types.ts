import type { ProfileRole } from '@/lib/auth-helpers';

export type DashboardWidgetId =
  | 'quick-actions'
  | 'reading'
  | 'reservation'
  | 'ke-kontrole'
  | 'team-snapshot'
  | 'metrics';

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  label: string;
  description: string;
  /** Roles that can add this widget. */
  roles: ProfileRole[];
}

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  {
    id: 'quick-actions',
    label: 'Rychlé akce',
    description: 'Tlačítka pro nejčastější činnosti — psaní esejí, rezervace, hledání knih.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'reading',
    label: 'Čtení',
    description: 'Tvůj postup v BookPoints a počet napsaných esejí.',
    roles: ['student', 'mentor'],
  },
  {
    id: 'reservation',
    label: 'Nadcházející rezervace',
    description: 'Tvoje nejbližší rezervace místnosti.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'ke-kontrole',
    label: 'Ke kontrole',
    description: 'Nepřečtené eseje tvého týmu, které čekají na kontrolu.',
    roles: ['coach', 'admin'],
  },
  {
    id: 'team-snapshot',
    label: 'Tým',
    description: 'Nejlepší čtenáři tvého týmu podle BookPoints.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'metrics',
    label: 'Metriky',
    description: 'Knižní body a počet zákaznických schůzek na jednom místě.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
];

export function widgetsForRole(role: ProfileRole): DashboardWidgetMeta[] {
  return DASHBOARD_WIDGETS.filter((w) => w.roles.includes(role));
}

/** Keeps only known widget ids allowed for the role, deduplicated, in given order. */
export function sanitizeWidgetIds(ids: unknown, role: ProfileRole): DashboardWidgetId[] {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(widgetsForRole(role).map((w) => w.id));
  const result: DashboardWidgetId[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && allowed.has(id as DashboardWidgetId) && !result.includes(id as DashboardWidgetId)) {
      result.push(id as DashboardWidgetId);
    }
  }
  return result;
}

/**
 * Drops widgets whose extra precondition isn't met (currently: 'metrics'
 * requires beta access), so a stale saved layout can't reference a widget
 * that will never get a node and render as a permanent loading skeleton.
 */
export function availableWidgetIds(ids: DashboardWidgetId[], hasMetricsAccess: boolean): DashboardWidgetId[] {
  return hasMetricsAccess ? ids : ids.filter((id) => id !== 'metrics');
}

export function availableWidgets(widgets: DashboardWidgetMeta[], hasMetricsAccess: boolean): DashboardWidgetMeta[] {
  return hasMetricsAccess ? widgets : widgets.filter((w) => w.id !== 'metrics');
}
