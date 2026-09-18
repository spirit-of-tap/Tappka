const DAY_KEY_PART_WIDTH = 2;
const DAY_KEY_PADDING = "0";
const DAY_KEY_SEPARATOR = "-";
const SEED_YEAR_FACTOR = 10_000;
const SEED_MONTH_FACTOR = 100;

/**
 * Local calendar day in `YYYY-MM-DD` form. Local time is used on purpose so
 * the Scrollky order rotates at local midnight, not at UTC midnight.
 */
export function getLocalDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(DAY_KEY_PART_WIDTH, DAY_KEY_PADDING);
  const day = String(date.getDate()).padStart(DAY_KEY_PART_WIDTH, DAY_KEY_PADDING);
  return `${year}${DAY_KEY_SEPARATOR}${month}${DAY_KEY_SEPARATOR}${day}`;
}

/**
 * Deterministic daily seed for the Scrollky shuffle. Stable for any time
 * within the same local day, different for consecutive days, so the feed
 * order holds for a day and rotates the next day.
 */
export function getDailySeed(date: Date = new Date()): number {
  return (
    date.getFullYear() * SEED_YEAR_FACTOR +
    (date.getMonth() + 1) * SEED_MONTH_FACTOR +
    date.getDate()
  );
}
