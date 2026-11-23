import { describe, expect, it } from 'vitest';

import { greetingName, validateGreetingName } from './greeting-name';

describe('validateGreetingName', () => {
  it('trims and collapses whitespace', () => {
    expect(validateGreetingName('  Páťa   K. ')).toEqual({ ok: true, value: 'Páťa K.' });
  });

  it('treats empty input as clearing the greeting', () => {
    expect(validateGreetingName('   ')).toEqual({ ok: true, value: null });
    expect(validateGreetingName(null)).toEqual({ ok: true, value: null });
  });

  it('rejects non-strings and overly long names', () => {
    expect(validateGreetingName(42).ok).toBe(false);
    expect(validateGreetingName('x'.repeat(41)).ok).toBe(false);
  });
});

describe('greetingName', () => {
  it('prefers the chosen greeting', () => {
    expect(greetingName({ name: 'Patrik Koudelka', preferred_name: 'Páťo' })).toBe('Páťo');
  });

  it('falls back to the first word of the name', () => {
    expect(greetingName({ name: 'Patrik Koudelka', preferred_name: null })).toBe('Patrik');
    expect(greetingName({ name: null })).toBe('');
  });
});
