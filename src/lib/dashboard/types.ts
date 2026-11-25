import type { ProfileRole } from '@/lib/auth-helpers';

export type DashboardWidgetId =
  | 'quick-actions'
  | 'next-session'
  | 'reading'
  | 'reservation'
  | 'ke-kontrole'
  | 'team-snapshot'
  | 'metrics';

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  label: string;
  description: string;
  /** Roles that can see this widget. */
  roles: ProfileRole[];
}

/** Canonical order: the dashboard always renders widgets in this order. */
export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  {
    id: 'quick-actions',
    label: 'Rychlé akce',
    description: 'Tlačítka pro nejčastější činnosti — psaní esejí, rezervace, hledání knih.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'next-session',
    label: 'Nejbližší training session',
    description: 'Tvoje nejbližší TS — vlastní tým nebo cross, na který jsi přihlášený:á.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'reservation',
    label: 'Nadcházející rezervace',
    description: 'Tvoje nejbližší rezervace místnosti.',
    roles: ['student', 'mentor', 'coach', 'admin'],
  },
  {
    id: 'ke-kontrole',
    label: 'Eseje ke kontrole',
    description: 'Pro kouče:ky: eseje tvého týmu, které jsi ještě nečetl:a.',
    roles: ['coach', 'admin'],
  },
  {
    id: 'reading',
    label: 'Čtení',
    description: 'Tvůj postup v knižních bodech a počet napsaných esejí.',
    roles: ['student', 'mentor'],
  },
  {
    id: 'team-snapshot',
    label: 'Tým',
    description: 'Nejlepší čtenáři:ky tvého týmu podle knižních bodů.',
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

/** 'metrics' additionally requires beta access. */
export function availableWidgets(widgets: DashboardWidgetMeta[], hasMetricsAccess: boolean): DashboardWidgetMeta[] {
  return hasMetricsAccess ? widgets : widgets.filter((w) => w.id !== 'metrics');
}

/**
 * Widgets the dashboard shows, in canonical order. A saved choice that leaves
 * nothing visible (none saved, or only widgets no longer available) falls back
 * to everything the role can see.
 */
export function resolveDashboardWidgets(
  saved: unknown,
  role: ProfileRole,
  hasMetricsAccess: boolean,
): DashboardWidgetId[] {
  const chosen = new Set(sanitizeWidgetIds(saved, role));
  const all = availableWidgets(widgetsForRole(role), hasMetricsAccess).map((w) => w.id);
  const shown = all.filter((id) => chosen.has(id));
  return shown.length === 0 ? all : shown;
}
