const TIME_ZONE = 'Europe/Prague';
const DAY_MS = 86_400_000;
export const ROOMS_WEEK_DAYS = 7;

export interface WeekReservationInput {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  room: { id: string; code: string; name: string } | null;
}

export interface WeekDay {
  key: string;
  weekday: string;
  day: string;
  label: string;
  isToday: boolean;
  count: number;
}

export interface WeekReservation {
  id: string;
  dayKey: string;
  dayLabel: string;
  time: string;
  roomCode: string | null;
  roomName: string;
  title: string;
}

/** YYYY-MM-DD of the Prague calendar day. */
function dayKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
}

function dayLabel(date: Date, offset: number): string {
  if (offset === 0) return 'Dnes';
  if (offset === 1) return 'Zítra';
  return date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: TIME_ZONE });
}

/**
 * Rolling seven-day strip from today plus the reservations that fall on it,
 * computed on the server so the client never formats dates in its own zone.
 */
export function buildRoomsWeek(
  reservations: WeekReservationInput[],
  now: Date,
): { days: WeekDay[]; items: WeekReservation[] } {
  const days: WeekDay[] = Array.from({ length: ROOMS_WEEK_DAYS }, (_, offset) => {
    const date = new Date(now.getTime() + offset * DAY_MS);
    return {
      key: dayKey(date),
      weekday: offset === 0 ? 'Dnes' : date.toLocaleDateString('cs-CZ', { weekday: 'short', timeZone: TIME_ZONE }),
      day: date.toLocaleDateString('cs-CZ', { day: 'numeric', timeZone: TIME_ZONE }).replace('.', ''),
      label: dayLabel(date, offset),
      isToday: offset === 0,
      count: 0,
    };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));

  const items = reservations.map((r) => {
    const key = dayKey(new Date(r.start_at));
    const day = byKey.get(key);
    if (day) day.count += 1;
    return {
      id: r.id,
      dayKey: key,
      dayLabel: day?.label ?? dayLabel(new Date(r.start_at), ROOMS_WEEK_DAYS),
      time: `${time(r.start_at)}–${time(r.end_at)}`,
      roomCode: r.room?.code ?? null,
      roomName: r.room?.name ?? r.title,
      title: r.room ? r.title : '',
    };
  });

  return { days, items };
}
