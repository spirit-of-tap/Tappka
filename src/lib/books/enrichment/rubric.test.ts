import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from './rubric';

describe('buildSystemPrompt', () => {
  it('tells the model to reject irrelevant books outright', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Výjimka C');
    expect(prompt).toContain('ZAMÍTNUTO: Kniha nesouvisí se zaměřením programu TAP.');
  });

  it('rejects fiction by genre, not by theme, ahead of Výjimka B', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('divadelní hry');
    expect(prompt).toContain('Rozhodující je žánr, ne téma');
    expect(prompt).toContain('přednost');
  });

  it('rejects pseudoscience, disinformation and clearly bad ratings', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Výjimka D');
    expect(prompt).toContain('konspirační');
    expect(prompt).toContain('3,5');
  });

  it('names the fields the model may flag as uncertain', () => {
    expect(buildSystemPrompt()).toContain('low_confidence_fields');
  });
});
