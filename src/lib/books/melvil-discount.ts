import { MELVIL_DISCOUNT } from '@/lib/constants/cteni';

const MELVIL_DISCOUNT_STARTS_AT_MS = Date.parse(MELVIL_DISCOUNT.startsAt);

/** Whether the Melvil partner discount is already announced at `now`. */
export function isMelvilDiscountLive(now: Date): boolean {
  return now.getTime() >= MELVIL_DISCOUNT_STARTS_AT_MS;
}
