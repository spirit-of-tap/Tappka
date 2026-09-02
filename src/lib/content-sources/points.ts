import type { ContentSourceKind } from './types';

/**
 * The allowed self-assigned point values. Includes 0.5 (the podcast default)
 * alongside the whole-number set books use — the DB only enforces 0..3, this
 * is the UI's picklist.
 */
export const CONTENT_SOURCE_POINT_VALUES = [0, 0.5, 1, 2, 3] as const;

export type ContentSourcePoints = (typeof CONTENT_SOURCE_POINT_VALUES)[number];

/**
 * Form pre-fill only — never a stored default or a DB constraint. A student
 * can still change it before submitting; other kinds start blank.
 */
export function defaultContentSourcePoints(kind: ContentSourceKind): ContentSourcePoints | null {
  return kind === 'podcast' ? 0.5 : null;
}
