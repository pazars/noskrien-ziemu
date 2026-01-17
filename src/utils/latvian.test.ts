import { describe, it, expect } from 'vitest';
import { normalizeLatvian, countLatvianChars, hasNaturalCasing } from './latvian';

describe('Latvian character utilities', () => {
  describe('normalizeLatvian', () => {
    it('should normalize lowercase Latvian characters', () => {
      expect(normalizeLatvian('Dāvis Pazars')).toBe('Davis Pazars');
      expect(normalizeLatvian('Kristaps Bērziņš')).toBe('Kristaps Berzins');
    });

    it('should normalize uppercase Latvian characters', () => {
      expect(normalizeLatvian('ILZE KRONBERGA')).toBe('ILZE KRONBERGA');
      expect(normalizeLatvian('JĀNIS KALNIŅŠ')).toBe('JANIS KALNINS');
    });

    it('should handle all Latvian special characters', () => {
      const input = 'āčēģīķļņšūž ĀČĒĢĪĶĻŅŠŪŽ';
      const expected = 'acegiklnsuz ACEGIKLNSUZ';
      expect(normalizeLatvian(input)).toBe(expected);
    });

    it('should preserve non-Latvian characters', () => {
      expect(normalizeLatvian('John Smith 123')).toBe('John Smith 123');
    });
  });

  describe('countLatvianChars', () => {
    it('should count lowercase Latvian characters', () => {
      expect(countLatvianChars('Dāvis')).toBe(1);
      expect(countLatvianChars('Bērziņš')).toBe(3); // ē, ņ, š
    });

    it('should count uppercase Latvian characters', () => {
      expect(countLatvianChars('JĀNIS')).toBe(1);
    });

    it('should return 0 for non-Latvian names', () => {
      expect(countLatvianChars('John Smith')).toBe(0);
    });
  });

  describe('hasNaturalCasing', () => {
    it('should return true for natural casing', () => {
      expect(hasNaturalCasing('Dāvis Pazars')).toBe(true);
      expect(hasNaturalCasing('davis pazars')).toBe(true);
    });

    it('should return false for all uppercase', () => {
      expect(hasNaturalCasing('DAVIS PAZARS')).toBe(false);
      expect(hasNaturalCasing('ILZE KRONBERGA')).toBe(false);
    });

    it('should handle names with Latvian characters', () => {
      expect(hasNaturalCasing('Kristaps Bērziņš')).toBe(true);
      expect(hasNaturalCasing('KRISTAPS BĒRZIŅŠ')).toBe(false);
    });
  });
});
