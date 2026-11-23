import { describe, expect, it } from 'vitest';

import { buildRoomsWeek } from './rooms-week';

const room = { id: 'r1', code: 'D127', name: 'D127 - Tichá místnost' };

describe('buildRoomsWeek', () => {
  const now = new Date('2026-11-23T21:30:00Z'); // 22:30 in Prague, Monday

  it('starts the strip today in Prague time and counts reservations per day', () => {
    const { days, items } = buildRoomsWeek(
      [
        { id: 'a', title: 'Koučink', start_at: '2026-11-23T23:30:00Z', end_at: '2026-11-23T23:50:00Z', room },
        { id: 'b', title: 'Pitch', start_at: '2026-11-24T08:00:00Z', end_at: '2026-11-24T09:00:00Z', room },
      ],
      now,
    );

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: '2026-11-23', weekday: 'Dnes', isToday: true });
    // 23:30Z on Monday is already Tuesday 00:30 in Prague.
    expect(days[1]).toMatchObject({ key: '2026-11-24', count: 2, label: 'Zítra' });
    expect(items[1]).toMatchObject({ dayKey: '2026-11-24', time: '09:00–10:00', roomCode: 'D127', title: 'Pitch' });
  });

  it('falls back to the title when a reservation has no room', () => {
    const { items } = buildRoomsWeek(
      [{ id: 'c', title: 'Venku', start_at: '2026-12-10T08:00:00Z', end_at: '2026-12-10T09:00:00Z', room: null }],
      now,
    );
    expect(items[0]).toMatchObject({ roomCode: null, roomName: 'Venku', title: '' });
  });
});
