/** Partner discount from nakladatelství Melvil, promoted on Objevovat. */
export const MELVIL_DISCOUNT = {
  code: 'TIIMI30',
  percent: 30,
  url: 'https://www.melvil.cz/?utm_source=tappka&utm_medium=referral&utm_campaign=tiimi30',
  /** Card stays hidden until 4. 11. 2026 11:00 Prague time (CET). */
  startsAt: '2026-11-04T11:00:00+01:00',
} as const;

/** Objevovat tab, where the Melvil discount card lives. */
export const CTENI_DISCOVER_HREF = '/cteni/hledat' as const;

/** Fragment id of the scrollky feed below the categories on Objevovat. */
export const CTENI_SCROLLKY_SECTION_ID = 'scrollky' as const;

/** Objevovat scrolled straight to the scrollky feed. */
export const CTENI_SCROLLKY_HREF = `${CTENI_DISCOVER_HREF}#${CTENI_SCROLLKY_SECTION_ID}` as const;

/** Fragment id of the "Tým a knižní body" section on Moje čtení. */
export const TEAM_BOOK_POINTS_SECTION_ID = 'tym-a-knizni-body' as const;

/** Moje čtení scrolled straight to the team leaderboard. */
export const TEAM_BOOK_POINTS_HREF = `/cteni/prehled#${TEAM_BOOK_POINTS_SECTION_ID}` as const;
