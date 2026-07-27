import { describe, expect, it } from 'vitest';

import { coachReadEmail, commentEmail, voteEmail } from './email-templates';

const ctx = {
  essayTitle: 'Moje esej o vedení',
  essayUrl: 'https://tappka.app/eseje/essay-1',
  actorName: 'Anna Nováková',
};

describe('coachReadEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = coachReadEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});

describe('commentEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = commentEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});

describe('voteEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = voteEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});
