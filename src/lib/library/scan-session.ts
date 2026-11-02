export interface LibraryLabelEntry {
  code: number;
  title: string;
}

export type LibraryLabelLookup = ReadonlyMap<number, string>;

export interface ScanDetection {
  key: string;
  at: number;
}

// A label held in front of the camera is detected every ~300 ms. Only treat
// it as a new scan once it has been out of frame for this long.
export const RESCAN_COOLDOWN_MS = 1_500;

export function buildLabelLookup(entries: readonly LibraryLabelEntry[]): LibraryLabelLookup {
  return new Map(entries.map((entry) => [entry.code, entry.title]));
}

export function shouldReportScan(last: ScanDetection | null, key: string, now: number): boolean {
  if (last == null) return true;
  if (last.key !== key) return true;

  return now - last.at >= RESCAN_COOLDOWN_MS;
}
