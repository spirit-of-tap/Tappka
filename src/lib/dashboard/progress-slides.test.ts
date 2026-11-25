import { describe, expect, it } from 'vitest';

import { bookPointsSlide, customerMeetingsSlide } from './progress-slides';

describe('bookPointsSlide', () => {
  it('measures points against the cumulative goal of the semester', () => {
    const slide = bookPointsSlide({ approved_points: 7, pending_points: 0, essay_count: 4 }, 3);
    expect(slide).toMatchObject({ goal: 60, studyTotal: 120, headline: 'Zbývá 53 bodů', ringLabel: '7 z 60 knižních bodů' });
    expect(slide.detail).toBe('Do konce semestru máš mít 60 bodů. 4 eseje.');
  });

  it('summarises pending books and reports a surplus', () => {
    const slide = bookPointsSlide({ approved_points: 25, pending_points: 1, essay_count: 0 }, 1);
    expect(slide.headline).toBe('Cíl splněn (+5)');
    expect(slide.detail).toContain('Zatím žádné eseje · 1 kniha čeká na schválení');
  });
});

describe('customerMeetingsSlide', () => {
  it('counts meetings against 10 per semester', () => {
    const slide = customerMeetingsSlide(7, 1);
    expect(slide).toMatchObject({ goal: 10, studyTotal: 60, headline: 'Zbývají 3 schůzky', href: '/schuzky' });
  });
});
