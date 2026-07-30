import { describe, expect, it } from 'vitest';

import { bookLoanEmail, coachReadEmail, commentEmail, voteEmail } from './email-templates';

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

  it('includes the comment body when provided', () => {
    const commentBody = 'Toto je testovací komentář!';
    const { html } = commentEmail({ ...ctx, commentBody });
    expect(html).toContain(commentBody);
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

describe('bookLoanEmail', () => {
  const loanCtx = {
    bookTitle: 'Atomové návyky',
    dueDate: '30. srpna 2026',
    loansUrl: 'https://tappka.app/knihovna/moje',
  };

  it('mentions the book title in the subject', () => {
    const { subject } = bookLoanEmail(loanCtx);
    expect(subject).toContain('Atomové návyky');
  });

  it('shows the due date and links to the loans page', () => {
    const { html } = bookLoanEmail(loanCtx);
    expect(html).toContain('30. srpna 2026');
    expect(html).toContain('https://tappka.app/knihovna/moje');
  });
});
