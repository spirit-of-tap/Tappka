import { describe, expect, it } from 'vitest';

import { validateContactInput } from './contact-validation';

const TODAY = new Date(2026, 10, 23);

describe('validateContactInput', () => {
  it('accepts and normalizes valid values', () => {
    const result = validateContactInput(
      { phone_number: '  +420  777 123 456 ', personal_email: ' Jmeno@Gmail.com ', date_of_birth: '2003-05-17' },
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      value: { phone_number: '+420 777 123 456', personal_email: 'jmeno@gmail.com', date_of_birth: '2003-05-17' },
    });
  });

  it('turns empty and missing values into null so fields can be cleared', () => {
    expect(validateContactInput({ phone_number: '', personal_email: '   ' }, TODAY)).toEqual({
      ok: true,
      value: { phone_number: null, personal_email: null, date_of_birth: null },
    });
  });

  it.each(['12345', '+420 abc 123 456', '+420-777-123-456', '1234567890123456'])('rejects phone %s', (phone) => {
    const result = validateContactInput({ phone_number: phone }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone_number).toBeDefined();
  });

  it.each(['jmeno', 'jmeno@gmail', 'a b@gmail.com'])('rejects personal email %s', (email) => {
    const result = validateContactInput({ personal_email: email }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.personal_email).toBeDefined();
  });

  it.each(['2026-02-30', '17.5.2003', '1899-12-31', '2026-11-24'])('rejects date of birth %s', (date) => {
    const result = validateContactInput({ date_of_birth: date }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.date_of_birth).toBeDefined();
  });

  it('accepts today as date of birth boundary', () => {
    expect(validateContactInput({ date_of_birth: '2026-11-23' }, TODAY).ok).toBe(true);
  });

  it('rejects non-string values', () => {
    const result = validateContactInput({ phone_number: 777123456, personal_email: {}, date_of_birth: [] }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['date_of_birth', 'personal_email', 'phone_number']);
  });

  it('reports every invalid field at once', () => {
    const result = validateContactInput({ phone_number: 'x', personal_email: 'y', date_of_birth: 'z' }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toHaveLength(3);
  });
});
