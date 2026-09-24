import { describe, expect, it } from 'vitest';
import {
  formatUrl,
  displayDomain,
  formatInstagramUrl,
  displayInstagram,
  cleanIco,
  getPublicRegistryUrl,
  validateIco,
} from './links';

describe('team links utilities', () => {
  describe('formatUrl', () => {
    it('prepends https:// if protocol is missing', () => {
      expect(formatUrl('tuuli.cz')).toBe('https://tuuli.cz');
    });

    it('keeps existing http/https protocols', () => {
      expect(formatUrl('http://tuuli.cz')).toBe('http://tuuli.cz');
      expect(formatUrl('https://tuuli.cz')).toBe('https://tuuli.cz');
    });

    it('returns null for empty or null inputs', () => {
      expect(formatUrl('')).toBeNull();
      expect(formatUrl('   ')).toBeNull();
      expect(formatUrl(null)).toBeNull();
      expect(formatUrl(undefined)).toBeNull();
    });
  });

  describe('displayDomain', () => {
    it('strips protocol, www and trailing slash', () => {
      expect(displayDomain('https://www.tuuli.cz/')).toBe('tuuli.cz');
      expect(displayDomain('http://tuuli.cz/projekty/')).toBe('tuuli.cz/projekty');
      expect(displayDomain('tuuli.cz')).toBe('tuuli.cz');
    });

    it('returns empty string for empty inputs', () => {
      expect(displayDomain('')).toBe('');
      expect(displayDomain(null)).toBe('');
    });
  });

  describe('formatInstagramUrl', () => {
    it('handles handles with @', () => {
      expect(formatInstagramUrl('@tuuliteam')).toBe('https://instagram.com/tuuliteam');
    });

    it('handles bare handles', () => {
      expect(formatInstagramUrl('tuuliteam')).toBe('https://instagram.com/tuuliteam');
    });

    it('handles full urls', () => {
      expect(formatInstagramUrl('https://instagram.com/tuuliteam')).toBe('https://instagram.com/tuuliteam');
    });

    it('returns null for empty inputs', () => {
      expect(formatInstagramUrl('')).toBeNull();
      expect(formatInstagramUrl(null)).toBeNull();
    });
  });

  describe('displayInstagram', () => {
    it('formats handles and full URLs into @handle format', () => {
      expect(displayInstagram('@tuuliteam')).toBe('@tuuliteam');
      expect(displayInstagram('tuuliteam')).toBe('@tuuliteam');
      expect(displayInstagram('https://www.instagram.com/tuuliteam/')).toBe('@tuuliteam');
    });

    it('returns empty string for empty inputs', () => {
      expect(displayInstagram('')).toBe('');
      expect(displayInstagram(null)).toBe('');
    });
  });

  describe('IČO utilities', () => {
    it('cleans whitespace from IČO', () => {
      expect(cleanIco(' 123 45 678 ')).toBe('12345678');
      expect(cleanIco('')).toBe('');
      expect(cleanIco(null)).toBe('');
    });

    it('generates public registry link', () => {
      expect(getPublicRegistryUrl('12345678')).toBe('https://verejnerejstriky.msp.gov.cz/vypis/12345678');
      expect(getPublicRegistryUrl(' 123 45 678 ')).toBe('https://verejnerejstriky.msp.gov.cz/vypis/12345678');
      expect(getPublicRegistryUrl(null)).toBeNull();
    });

    it('validates 8-digit IČO', () => {
      expect(validateIco('12345678')).toEqual({ ok: true, value: '12345678' });
      expect(validateIco(' 123 45 678 ')).toEqual({ ok: true, value: '12345678' });
      expect(validateIco('')).toEqual({ ok: true, value: null });
      expect(validateIco(null)).toEqual({ ok: true, value: null });

      const invalid = validateIco('12345');
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.error).toContain('8 číslic');
      }

      const nonDigits = validateIco('1234567a');
      expect(nonDigits.ok).toBe(false);
    });
  });
});
